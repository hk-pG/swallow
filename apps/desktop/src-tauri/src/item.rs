use serde::{Deserialize, Serialize};

/// Mirrors `ItemMetadata` in `packages/shared/src/library.ts`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ItemMetadata {
    pub id: String,
    pub name: String,
    pub ext: String,
    pub size: u64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub tags: Vec<String>,
    pub folders: Vec<String>,
    pub annotation: String,
    pub star: u8,
    pub url: Option<String>,
    pub created_at: i64,
    pub modified_at: i64,
    pub is_deleted: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_with_shared_field_names() {
        let item = ItemMetadata {
            id: "01J0000000000000000000000".into(),
            name: "photo".into(),
            ext: "png".into(),
            size: 10,
            width: Some(2),
            height: None,
            tags: vec![],
            folders: vec![],
            annotation: String::new(),
            star: 0,
            url: None,
            created_at: 1,
            modified_at: 2,
            is_deleted: false,
        };
        let json = serde_json::to_value(&item).unwrap();
        assert_eq!(
            json,
            serde_json::json!({
                "id": "01J0000000000000000000000",
                "name": "photo",
                "ext": "png",
                "size": 10,
                "width": 2,
                "height": null,
                "tags": [],
                "folders": [],
                "annotation": "",
                "star": 0,
                "url": null,
                "createdAt": 1,
                "modifiedAt": 2,
                "isDeleted": false
            })
        );
    }
}
