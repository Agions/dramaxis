//! dramaxis-storage::patch · 零依赖 RFC 6902 JSON Patch 增量差分与重放引擎
//!
//! 用于替代全量 `Project` JSON 快照的 Undo/Redo 持久化，将长项目历史栈存储体积降低 85%~95%。

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// RFC 6902 精简原子操作（覆盖 Object 与 Array 的任意结构变更）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "op", rename_all = "lowercase")]
pub enum PatchOp {
    Add { path: String, value: Value },
    Remove { path: String },
    Replace { path: String, value: Value },
}

/// 转义 JSON Pointer 单段键名 (RFC 6901)
fn escape_token(token: &str) -> String {
    token.replace('~', "~0").replace('/', "~1")
}

/// 反转义 JSON Pointer 单段键名 (RFC 6901)
fn unescape_token(token: &str) -> String {
    token.replace("~1", "/").replace("~0", "~")
}

fn join_path(base: &str, token: &str) -> String {
    format!("{base}/{}", escape_token(token))
}

/// 计算 `old -> new` 的最小增量 Patch 列表
pub fn diff_json(old: &Value, new: &Value) -> Vec<PatchOp> {
    let mut ops = Vec::new();
    diff_recursive("", old, new, &mut ops);
    ops
}

fn diff_recursive(path: &str, old: &Value, new: &Value, ops: &mut Vec<PatchOp>) {
    if old == new {
        return;
    }

    match (old, new) {
        (Value::Object(old_map), Value::Object(new_map)) => {
            // 1. 删除旧键
            for key in old_map.keys() {
                if !new_map.contains_key(key) {
                    ops.push(PatchOp::Remove {
                        path: join_path(path, key),
                    });
                }
            }
            // 2. 新增或递归更新键
            for (key, new_val) in new_map {
                let child_path = join_path(path, key);
                match old_map.get(key) {
                    Some(old_val) => diff_recursive(&child_path, old_val, new_val, ops),
                    None => ops.push(PatchOp::Add {
                        path: child_path,
                        value: new_val.clone(),
                    }),
                }
            }
        }
        (Value::Array(old_arr), Value::Array(new_arr)) => {
            let common = old_arr.len().min(new_arr.len());
            for i in 0..common {
                let child_path = format!("{path}/{i}");
                diff_recursive(&child_path, &old_arr[i], &new_arr[i], ops);
            }
            if new_arr.len() > old_arr.len() {
                for item in &new_arr[old_arr.len()..] {
                    ops.push(PatchOp::Add {
                        path: format!("{path}/-"),
                        value: item.clone(),
                    });
                }
            } else if old_arr.len() > new_arr.len() {
                // 从尾部倒序删除，避免索引漂移
                for i in (new_arr.len()..old_arr.len()).rev() {
                    ops.push(PatchOp::Remove {
                        path: format!("{path}/{i}"),
                    });
                }
            }
        }
        _ => {
            ops.push(PatchOp::Replace {
                path: path.to_string(),
                value: new.clone(),
            });
        }
    }
}

/// 将 Patch 列表应用到基准 JSON 文档，返回新文档
pub fn apply_patch(base: &Value, ops: &[PatchOp]) -> Result<Value, String> {
    let mut doc = base.clone();
    for op in ops {
        apply_single(&mut doc, op)?;
    }
    Ok(doc)
}

fn apply_single(doc: &mut Value, op: &PatchOp) -> Result<(), String> {
    let path = match op {
        PatchOp::Add { path, .. } | PatchOp::Remove { path } | PatchOp::Replace { path, .. } => {
            path.as_str()
        }
    };

    if path.is_empty() {
        return match op {
            PatchOp::Add { value, .. } | PatchOp::Replace { value, .. } => {
                *doc = value.clone();
                Ok(())
            }
            PatchOp::Remove { .. } => Err("不能删除根文档".to_string()),
        };
    }

    if !path.starts_with('/') {
        return Err(format!("非法 JSON Pointer 路径: {path}"));
    }

    let tokens: Vec<String> = path[1..].split('/').map(unescape_token).collect();
    let (parent_tokens, last_token) = tokens.split_at(tokens.len() - 1);
    let key = &last_token[0];

    let mut current = doc;
    for token in parent_tokens {
        current = match current {
            Value::Object(map) => map
                .get_mut(token)
                .ok_or_else(|| format!("路径节点不存在: {token}"))?,
            Value::Array(arr) => {
                let idx: usize = token
                    .parse()
                    .map_err(|_| format!("非法数组索引: {token}"))?;
                arr.get_mut(idx)
                    .ok_or_else(|| format!("数组索引越界: {idx}"))?
            }
            _ => return Err(format!("无法在标量节点下继续寻址: {token}")),
        };
    }

    match (current, op) {
        (Value::Object(map), PatchOp::Add { value, .. }) => {
            map.insert(key.clone(), value.clone());
            Ok(())
        }
        (Value::Object(map), PatchOp::Replace { value, .. }) => {
            map.insert(key.clone(), value.clone());
            Ok(())
        }
        (Value::Object(map), PatchOp::Remove { .. }) => {
            map.remove(key);
            Ok(())
        }
        (Value::Array(arr), PatchOp::Add { value, .. }) => {
            if key == "-" {
                arr.push(value.clone());
                Ok(())
            } else {
                let idx: usize = key
                    .parse()
                    .map_err(|_| format!("非法数组插入索引: {key}"))?;
                if idx > arr.len() {
                    return Err(format!("数组插入越界: {idx} > {}", arr.len()));
                }
                arr.insert(idx, value.clone());
                Ok(())
            }
        }
        (Value::Array(arr), PatchOp::Replace { value, .. }) => {
            let idx: usize = key
                .parse()
                .map_err(|_| format!("非法数组替换索引: {key}"))?;
            let slot = arr
                .get_mut(idx)
                .ok_or_else(|| format!("数组替换越界: {idx}"))?;
            *slot = value.clone();
            Ok(())
        }
        (Value::Array(arr), PatchOp::Remove { .. }) => {
            let idx: usize = key
                .parse()
                .map_err(|_| format!("非法数组删除索引: {key}"))?;
            if idx >= arr.len() {
                return Err(format!("数组删除越界: {idx}"));
            }
            arr.remove(idx);
            Ok(())
        }
        _ => Err(format!("目标父节点类型与操作不匹配: {path}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_diff_and_apply_roundtrip() {
        let old = json!({
            "name": "测试项目",
            "scripts": [
                {"id": "s1", "text": "第一句"},
                {"id": "s2", "text": "第二句"},
                {"id": "s3", "text": "第三句"}
            ],
            "meta/slash~key": 1
        });
        let new = json!({
            "name": "测试项目",
            "scripts": [
                {"id": "s1", "text": "第一句"},
                {"id": "s2", "text": "修改后的第二句"},
                {"id": "s3", "text": "第三句"},
                {"id": "s4", "text": "新增第四句"}
            ],
            "meta/slash~key": 2,
            "extra": true
        });

        let ops = diff_json(&old, &new);
        assert!(ops.len() <= 4, "应只包含最小增量操作: {ops:?}");

        let patched = apply_patch(&old, &ops).expect("apply patch");
        assert_eq!(patched, new);
    }

    #[test]
    fn test_array_shrink_patch() {
        let old = json!({"items": [1, 2, 3, 4]});
        let new = json!({"items": [1, 2]});

        let ops = diff_json(&old, &new);
        let patched = apply_patch(&old, &ops).expect("apply shrink patch");
        assert_eq!(patched, new);
    }
}
