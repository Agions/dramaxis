//! dramaxis-core · i18n — 后端多语言翻译工具

use std::collections::HashMap;
use std::sync::RwLock;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Locale {
    ZhCn,
    EnUs,
}

impl Locale {
    pub fn parse(s: &str) -> Option<Self> {
        let norm = s.to_lowercase().replace('_', "-");
        if norm.starts_with("zh") {
            Some(Self::ZhCn)
        } else if norm.starts_with("en") {
            Some(Self::EnUs)
        } else {
            None
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ZhCn => "zh-CN",
            Self::EnUs => "en-US",
        }
    }
}

pub struct Translator {
    locale: RwLock<Locale>,
    messages: RwLock<HashMap<String, HashMap<String, String>>>,
}

impl std::fmt::Debug for Translator {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let loc = self.locale();
        f.debug_struct("Translator").field("locale", &loc).finish()
    }
}

impl Translator {
    pub fn new(default_locale: Locale) -> Self {
        Self {
            locale: RwLock::new(default_locale),
            messages: RwLock::new(HashMap::new()),
        }
    }

    pub fn with_backend_defaults() -> Self {
        let t = Self::new(Locale::ZhCn);
        let mut zh = HashMap::new();
        zh.insert("app.name".into(), "剧枢 · Dramaxis".into());
        zh.insert("common.success".into(), "操作成功".into());
        zh.insert("common.failed".into(), "操作失败".into());
        zh.insert("export.completed".into(), "视频工程导出完成".into());
        zh.insert("detect.completed".into(), "场景切片识别完成".into());

        let mut en = HashMap::new();
        en.insert("app.name".into(), "Dramaxis Studio".into());
        en.insert("common.success".into(), "Success".into());
        en.insert("common.failed".into(), "Failed".into());
        en.insert("export.completed".into(), "Export Completed".into());
        en.insert(
            "detect.completed".into(),
            "Scene Detection Completed".into(),
        );

        t.register_messages("zh-CN", zh);
        t.register_messages("en-US", en);
        t
    }

    pub fn register_messages(&self, locale: &str, msgs: HashMap<String, String>) {
        let mut lock = self.messages.write().unwrap_or_else(|e| e.into_inner());
        let entry = lock.entry(locale.to_string()).or_default();
        entry.extend(msgs);
    }

    pub fn locale(&self) -> Locale {
        self.locale
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    pub fn try_set_locale(&self, raw: &str) -> bool {
        if let Some(loc) = Locale::parse(raw) {
            let mut w = self.locale.write().unwrap_or_else(|e| e.into_inner());
            *w = loc;
            true
        } else {
            false
        }
    }

    pub fn t(&self, key: &str) -> String {
        let loc = self.locale().as_str().to_string();
        let lock = self.messages.read().unwrap_or_else(|e| e.into_inner());
        if let Some(map) = lock.get(&loc) {
            if let Some(val) = map.get(key) {
                return val.clone();
            }
        }
        key.to_string()
    }

    pub fn t_with_args(&self, key: &str, pairs: &[(&str, &str)]) -> String {
        let mut msg = self.t(key);
        for (k, v) in pairs {
            msg = msg.replace(&format!("{{{k}}}"), v);
        }
        msg
    }
}
