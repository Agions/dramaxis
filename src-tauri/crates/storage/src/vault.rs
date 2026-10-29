//! dramaxis-storage::vault · 安全凭证隔离金库 (Secure Credential Vault)
//!
//! 专为存储 OpenAI, Claude, DeepSeek, TTS 等 API 密钥而设计。
//! 机制：
//! 1. 基于本地机器指纹与 SHA-256 派生本地专属加密掩码。
//! 2. 凭证落盘为独立受保护的 `credentials.vault` 文件，设置受限权限。
//! 3. 避免任何敏感密钥以明文形式残留在公开的 `config.json` 中。

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

const VAULT_SALT: &[u8] = b"dramaxis-credential-vault-v1-secure-salt";

/// 凭证金库
#[derive(Debug, Clone, Default)]
pub struct CredentialVault {
    entries: HashMap<String, String>,
}

impl CredentialVault {
    /// 派生当前机器专属密钥掩码
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

    /// 简单的流式字节异或加密/解密 (对称可逆)
    fn xor_cipher(data: &[u8], key: &[u8; 32]) -> Vec<u8> {
        data.iter()
            .enumerate()
            .map(|(i, &b)| b ^ key[i % key.len()] ^ ((i & 0xFF) as u8))
            .collect()
    }

    /// 从受保护的文件中加载金库
    pub async fn load(path: &Path) -> Self {
        if !path.exists() {
            return Self::default();
        }

        if let Ok(cipher_bytes) = tokio::fs::read(path).await {
            let key = Self::derive_machine_key();
            let decrypted = Self::xor_cipher(&cipher_bytes, &key);
            if let Ok(entries) = serde_json::from_slice::<HashMap<String, String>>(&decrypted) {
                return Self { entries };
            }
        }

        Self::default()
    }

    /// 保存金库到磁盘
    pub async fn save(&self, path: &Path) -> Result<(), std::io::Error> {
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let key = Self::derive_machine_key();
        let plain_bytes = serde_json::to_vec(&self.entries)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
        let encrypted = Self::xor_cipher(&plain_bytes, &key);

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

    /// 默认金库存储路径 (例如 `app_data_dir/credentials.vault`)
    pub fn default_vault_path(app_data_dir: &Path) -> PathBuf {
        app_data_dir.join("credentials.vault")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_vault_roundtrip() {
        let tmp = std::env::temp_dir().join(format!("test_vault_{}.vault", uuid_v4_simple()));
        let mut vault = CredentialVault::default();
        vault.set("openai_api_key", "sk-proj-1234567890abcdef");
        vault.set("claude_api_key", "sk-ant-0987654321fedcba");

        vault.save(&tmp).await.expect("save vault");

        // 校验落盘内容非明文
        let disk_bytes = tokio::fs::read(&tmp).await.expect("read vault");
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

    fn uuid_v4_simple() -> u64 {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos() as u64
    }
}
