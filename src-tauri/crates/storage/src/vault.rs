//! dramaxis-storage::vault · 安全凭证隔离金库 (Secure Credential Vault)
//!
//! 专为存储 OpenAI, Claude, DeepSeek, TTS 等 API 密钥而设计。
//! 机制：
//! 1. 基于本地机器指纹与 SHA-256 派生本地专属 256 位密钥。
//! 2. 凭证落盘为独立受保护的 `credentials.vault` 文件，设置受限权限 (0600)。
//! 3. 采用标准 AES-256-GCM 认证加密 (DRA2 魔数 + 12 字节随机 Nonce + 密文 + 16 字节 Auth Tag)。
//! 4. 自动向后兼容旧版异或编码凭证文件，并在保存时平滑无缝升级到 AES-256-GCM。

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use ring::aead::{AES_256_GCM, LessSafeKey, Nonce, UnboundKey, NONCE_LEN};
use ring::rand::{SecureRandom, SystemRandom};
use sha2::{Digest, Sha256};

const VAULT_SALT: &[u8] = b"dramaxis-credential-vault-v1-secure-salt";
const VAULT_MAGIC_V2: &[u8; 4] = b"DRA2";

/// 凭证金库
#[derive(Debug, Clone, Default)]
pub struct CredentialVault {
    entries: HashMap<String, String>,
}

impl CredentialVault {
    /// 派生当前机器专属密钥掩码 (32 字节 / 256 位)
    fn derive_machine_key() -> [u8; 32] {
        let mut hasher = Sha256::new();
        hasher.update(VAULT_SALT);

        if let Ok(hostname) = std::env::var("HOSTNAME").or_else(|_| std::env::var("HOST")) {
            hasher.update(hostname.as_bytes());
        }
        if let Some(home) = dirs::home_dir() {
            hasher.update(home.to_string_lossy().as_bytes());
        }
        if let Some(user) = dirs::data_dir() {
            hasher.update(user.to_string_lossy().as_bytes());
        }

        let result = hasher.finalize();
        let mut key = [0u8; 32];
        key.copy_from_slice(&result[..32]);
        key
    }

    /// 旧版流式异或解密 (向后兼容 v1.0/v1.1)
    fn legacy_xor_cipher(data: &[u8], key: &[u8; 32]) -> Vec<u8> {
        data.iter()
            .enumerate()
            .map(|(i, &b)| b ^ key[i % key.len()] ^ ((i & 0xFF) as u8))
            .collect()
    }

    /// 使用 AES-256-GCM 加密数据
    fn encrypt_aes256_gcm(plain_bytes: &[u8], key_bytes: &[u8; 32]) -> Result<Vec<u8>, std::io::Error> {
        let unbound_key = UnboundKey::new(&AES_256_GCM, key_bytes)
            .map_err(|_| std::io::Error::other("AES-256 key init failed"))?;
        let key = LessSafeKey::new(unbound_key);

        let rng = SystemRandom::new();
        let mut nonce_bytes = [0u8; NONCE_LEN];
        rng.fill(&mut nonce_bytes)
            .map_err(|_| std::io::Error::other("Failed to generate random nonce"))?;

        let nonce = Nonce::try_assume_unique_for_key(&nonce_bytes)
            .map_err(|_| std::io::Error::other("Invalid nonce"))?;

        let mut in_out = plain_bytes.to_vec();
        key.seal_in_place_append_tag(nonce, ring::aead::Aad::empty(), &mut in_out)
            .map_err(|_| std::io::Error::other("AES-GCM encryption failed"))?;

        // 组装格式: DRA2 (4B) + Nonce (12B) + Ciphertext & Tag
        let mut result = Vec::with_capacity(4 + NONCE_LEN + in_out.len());
        result.extend_from_slice(VAULT_MAGIC_V2);
        result.extend_from_slice(&nonce_bytes);
        result.extend_from_slice(&in_out);

        Ok(result)
    }

    /// 使用 AES-256-GCM 解密数据
    fn decrypt_aes256_gcm(encrypted: &[u8], key_bytes: &[u8; 32]) -> Result<Vec<u8>, std::io::Error> {
        if encrypted.len() < 4 + NONCE_LEN + 16 {
            return Err(std::io::Error::new(std::io::ErrorKind::UnexpectedEof, "Vault payload too short"));
        }

        let nonce_bytes = &encrypted[4..4 + NONCE_LEN];
        let mut in_out = encrypted[4 + NONCE_LEN..].to_vec();

        let unbound_key = UnboundKey::new(&AES_256_GCM, key_bytes)
            .map_err(|_| std::io::Error::other("AES-256 key init failed"))?;
        let key = LessSafeKey::new(unbound_key);

        let nonce = Nonce::try_assume_unique_for_key(nonce_bytes)
            .map_err(|_| std::io::Error::other("Invalid nonce"))?;

        let decrypted = key.open_in_place(nonce, ring::aead::Aad::empty(), &mut in_out)
            .map_err(|_| std::io::Error::new(std::io::ErrorKind::InvalidData, "AES-GCM decryption / authentication failed"))?;

        Ok(decrypted.to_vec())
    }

    /// 从受保护的文件中加载金库
    pub async fn load(path: &Path) -> Self {
        if !path.exists() {
            return Self::default();
        }

        if let Ok(raw_bytes) = tokio::fs::read(path).await {
            let key = Self::derive_machine_key();

            // 1. 如果包含 DRA2 头部，优先使用 AES-256-GCM 解密
            if raw_bytes.starts_with(VAULT_MAGIC_V2) {
                if let Ok(decrypted) = Self::decrypt_aes256_gcm(&raw_bytes, &key) {
                    if let Ok(entries) = serde_json::from_slice::<HashMap<String, String>>(&decrypted) {
                        return Self { entries };
                    }
                }
            }

            // 2. 向后兼容：尝试使用旧版 XOR 解密
            let decrypted = Self::legacy_xor_cipher(&raw_bytes, &key);
            if let Ok(entries) = serde_json::from_slice::<HashMap<String, String>>(&decrypted) {
                return Self { entries };
            }
        }

        Self::default()
    }

    /// 保存金库到磁盘 (默认统一保存为 AES-256-GCM v2 格式)
    pub async fn save(&self, path: &Path) -> Result<(), std::io::Error> {
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let key = Self::derive_machine_key();
        let plain_bytes = serde_json::to_vec(&self.entries)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;

        let encrypted = Self::encrypt_aes256_gcm(&plain_bytes, &key)?;

        tokio::fs::write(path, encrypted).await?;

        // 在 Unix 上将文件权限设置为 0600 (仅所有者可读写)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perm = std::fs::Permissions::from_mode(0o600);
            let _ = tokio::fs::set_permissions(path, perm).await;
        }

        Ok(())
    }

    /// 获取凭证
    pub fn get(&self, key: &str) -> Option<&String> {
        self.entries.get(key)
    }

    /// 设置凭证
    pub fn set(&mut self, key: impl Into<String>, value: impl Into<String>) {
        let v = value.into();
        if v.trim().is_empty() {
            self.entries.remove(&key.into());
        } else {
            self.entries.insert(key.into(), v);
        }
    }

    /// 移除凭证
    pub fn remove(&mut self, key: &str) -> Option<String> {
        self.entries.remove(key)
    }

    /// 获取全部条目副本
    pub fn entries(&self) -> HashMap<String, String> {
        self.entries.clone()
    }

    /// 默认金库存储路径 (例如 `app_data_dir/credentials.vault`)
    pub fn default_vault_path(app_data_dir: &Path) -> PathBuf {
        app_data_dir.join("credentials.vault")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_vault_roundtrip_aes_gcm() {
        let tmp = std::env::temp_dir().join(format!("test_vault_aes_{}.vault", uuid_v4_simple()));
        let mut vault = CredentialVault::default();
        vault.set("openai_api_key", "sk-proj-1234567890abcdef");
        vault.set("claude_api_key", "sk-ant-0987654321fedcba");

        vault.save(&tmp).await.expect("save vault");

        // 校验落盘内容为 DRA2 开头且非明文
        let disk_bytes = tokio::fs::read(&tmp).await.expect("read vault");
        assert!(disk_bytes.starts_with(b"DRA2"));
        let disk_str = String::from_utf8_lossy(&disk_bytes);
        assert!(!disk_str.contains("sk-proj-1234567890abcdef"));
        assert!(!disk_str.contains("sk-ant-0987654321fedcba"));

        // 加载并校验解密还原
        let loaded = CredentialVault::load(&tmp).await;
        assert_eq!(
            loaded.get("openai_api_key").map(|s| s.as_str()),
            Some("sk-proj-1234567890abcdef")
        );
        assert_eq!(
            loaded.get("claude_api_key").map(|s| s.as_str()),
            Some("sk-ant-0987654321fedcba")
        );

        let _ = tokio::fs::remove_file(&tmp).await;
    }

    #[tokio::test]
    async fn test_vault_legacy_xor_backward_compatibility() {
        let tmp = std::env::temp_dir().join(format!("test_vault_legacy_{}.vault", uuid_v4_simple()));
        let key = CredentialVault::derive_machine_key();

        // 构造旧版异或加密文件 (无 DRA2 头部)
        let mut legacy_map = HashMap::new();
        legacy_map.insert("legacy_key".to_string(), "legacy_secret_value".to_string());
        let plain = serde_json::to_vec(&legacy_map).unwrap();
        let legacy_cipher = CredentialVault::legacy_xor_cipher(&plain, &key);

        tokio::fs::write(&tmp, legacy_cipher).await.unwrap();

        // 加载旧版文件应成功解密
        let loaded = CredentialVault::load(&tmp).await;
        assert_eq!(
            loaded.get("legacy_key").map(|s| s.as_str()),
            Some("legacy_secret_value")
        );

        // 重新保存应无缝自动升级为 AES-256-GCM (带 DRA2 头部)
        loaded.save(&tmp).await.unwrap();
        let disk_bytes = tokio::fs::read(&tmp).await.unwrap();
        assert!(disk_bytes.starts_with(b"DRA2"));

        let reloaded = CredentialVault::load(&tmp).await;
        assert_eq!(
            reloaded.get("legacy_key").map(|s| s.as_str()),
            Some("legacy_secret_value")
        );

        let _ = tokio::fs::remove_file(&tmp).await;
    }

    fn uuid_v4_simple() -> u64 {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos() as u64
    }
}
