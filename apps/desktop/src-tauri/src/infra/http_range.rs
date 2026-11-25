//! RFC 9110 `Range: bytes=` parsing for the `thumb://` custom protocol.

/// Max bytes returned in a single 206 response (open-ended, closed, and suffix ranges).
/// WebKit may issue many sequential ranges; capping one response limits memory.
pub const MAX_RANGE_CHUNK_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ByteRange {
    pub start: u64,
    pub end_inclusive: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RangeParseResult {
    Satisfied(ByteRange),
    /// Valid syntactically but no bytes overlap the file (416).
    Unsatisfiable,
    /// Unknown unit or `start > end` — ignore Range and serve 200 (RFC 9110).
    Ignore,
    /// Other invalid syntax (416).
    Malformed,
}

/// Limits how many bytes a satisfied range may cover in one response.
pub fn clamp_satisfied_range(range: ByteRange, max_chunk: u64) -> ByteRange {
    if max_chunk == 0 {
        return range;
    }
    let max_end = range.start.saturating_add(max_chunk - 1);
    if range.end_inclusive <= max_end {
        return range;
    }
    ByteRange {
        start: range.start,
        end_inclusive: max_end,
    }
}

/// Parses the value of a single `Range` header against `content_len` bytes.
pub fn parse_bytes_range(header_value: &str, content_len: u64) -> RangeParseResult {
    parse_bytes_range_with_max(header_value, content_len, MAX_RANGE_CHUNK_BYTES)
}

/// Multi-range values (`bytes=0-1, 2-3`) use **only the first** range spec; the rest are ignored.
pub fn parse_bytes_range_with_max(
    header_value: &str,
    content_len: u64,
    max_chunk: u64,
) -> RangeParseResult {
    let trimmed = header_value.trim();
    let Some(spec) = trimmed.strip_prefix("bytes=") else {
        return RangeParseResult::Ignore;
    };
    let first = spec.split(',').next().unwrap_or("").trim();
    if first.is_empty() {
        return RangeParseResult::Malformed;
    }

    if let Some(suffix) = first.strip_prefix('-') {
        let suffix = suffix.trim();
        if suffix.is_empty() {
            return RangeParseResult::Malformed;
        }
        let Ok(suffix_len) = suffix.parse::<u64>() else {
            return RangeParseResult::Malformed;
        };
        if suffix_len == 0 {
            return RangeParseResult::Malformed;
        }
        if content_len == 0 {
            return RangeParseResult::Unsatisfiable;
        }
        let start = content_len.saturating_sub(suffix_len);
        let range = ByteRange {
            start,
            end_inclusive: content_len - 1,
        };
        return RangeParseResult::Satisfied(clamp_satisfied_range(range, max_chunk));
    }

    let Some((start_str, end_str)) = first.split_once('-') else {
        return RangeParseResult::Malformed;
    };
    let start_str = start_str.trim();
    if start_str.is_empty() {
        return RangeParseResult::Malformed;
    }
    let Ok(start) = start_str.parse::<u64>() else {
        return RangeParseResult::Malformed;
    };

    if end_str.is_empty() {
        if start >= content_len {
            return RangeParseResult::Unsatisfiable;
        }
        let file_end = content_len - 1;
        let range = ByteRange {
            start,
            end_inclusive: file_end,
        };
        return RangeParseResult::Satisfied(clamp_satisfied_range(range, max_chunk));
    }

    let end_str = end_str.trim();
    if end_str.is_empty() {
        return RangeParseResult::Malformed;
    }
    let Ok(mut end) = end_str.parse::<u64>() else {
        return RangeParseResult::Malformed;
    };
    if start > end {
        return RangeParseResult::Ignore;
    }
    if start >= content_len {
        return RangeParseResult::Unsatisfiable;
    }
    if end >= content_len {
        end = content_len - 1;
    }
    if end < start {
        return RangeParseResult::Unsatisfiable;
    }
    let range = ByteRange {
        start,
        end_inclusive: end,
    };
    RangeParseResult::Satisfied(clamp_satisfied_range(range, max_chunk))
}

pub fn content_range_value(range: ByteRange, total_len: u64) -> String {
    format!(
        "bytes {}-{}/{}",
        range.start, range.end_inclusive, total_len
    )
}

pub fn content_range_unsatisfiable(total_len: u64) -> String {
    format!("bytes */{total_len}")
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_CAP: u64 = 16;

    #[test]
    fn satisfied_first_middle_last_bytes() {
        let len = 1000u64;
        assert_eq!(
            parse_bytes_range("bytes=0-499", len),
            RangeParseResult::Satisfied(ByteRange {
                start: 0,
                end_inclusive: 499
            })
        );
    }

    #[test]
    fn suffix_and_open_ended() {
        let len = 100u64;
        assert_eq!(
            parse_bytes_range("bytes=-10", len),
            RangeParseResult::Satisfied(ByteRange {
                start: 90,
                end_inclusive: 99
            })
        );
        assert_eq!(
            parse_bytes_range("bytes=50-", len),
            RangeParseResult::Satisfied(ByteRange {
                start: 50,
                end_inclusive: 99
            })
        );
    }

    #[test]
    fn open_ended_chunk_cap() {
        let len = MAX_RANGE_CHUNK_BYTES + 100;
        let RangeParseResult::Satisfied(parsed) = parse_bytes_range("bytes=0-", len) else {
            panic!("expected satisfied");
        };
        assert_eq!(parsed.start, 0);
        assert_eq!(parsed.end_inclusive, MAX_RANGE_CHUNK_BYTES - 1);
    }

    #[test]
    fn closed_range_clamped_to_max_chunk() {
        let len = 10_000u64;
        let RangeParseResult::Satisfied(parsed) =
            parse_bytes_range_with_max("bytes=0-9999", len, TEST_CAP)
        else {
            panic!("expected satisfied");
        };
        assert_eq!(parsed.start, 0);
        assert_eq!(parsed.end_inclusive, TEST_CAP - 1);
    }

    #[test]
    fn suffix_clamped_to_max_chunk() {
        let len = 10_000u64;
        let RangeParseResult::Satisfied(parsed) =
            parse_bytes_range_with_max("bytes=-5000", len, TEST_CAP)
        else {
            panic!("expected satisfied");
        };
        assert_eq!(parsed.end_inclusive - parsed.start + 1, TEST_CAP);
    }

    #[test]
    fn clamps_end_beyond_len() {
        assert_eq!(
            parse_bytes_range("bytes=0-9999", 100),
            RangeParseResult::Satisfied(ByteRange {
                start: 0,
                end_inclusive: 99
            })
        );
    }

    #[test]
    fn unsatisfiable_malformed_and_ignore() {
        assert_eq!(
            parse_bytes_range("bytes=100-", 100),
            RangeParseResult::Unsatisfiable
        );
        assert_eq!(
            parse_bytes_range("bytes=200-300", 100),
            RangeParseResult::Unsatisfiable
        );
        assert_eq!(parse_bytes_range("items=0-1", 10), RangeParseResult::Ignore);
        assert_eq!(parse_bytes_range("bytes=", 10), RangeParseResult::Malformed);
        assert_eq!(
            parse_bytes_range("bytes=abc-def", 10),
            RangeParseResult::Malformed
        );
        assert_eq!(parse_bytes_range("bytes=5-3", 10), RangeParseResult::Ignore);
    }

    #[test]
    fn zero_length_file() {
        assert_eq!(
            parse_bytes_range("bytes=0-", 0),
            RangeParseResult::Unsatisfiable
        );
        assert_eq!(
            parse_bytes_range("bytes=-1", 0),
            RangeParseResult::Unsatisfiable
        );
    }

    #[test]
    fn suffix_larger_than_file() {
        assert_eq!(
            parse_bytes_range("bytes=-500", 100),
            RangeParseResult::Satisfied(ByteRange {
                start: 0,
                end_inclusive: 99
            })
        );
    }

    #[test]
    fn multi_range_uses_first_only() {
        assert_eq!(
            parse_bytes_range("bytes=0-1, 2-3", 100),
            RangeParseResult::Satisfied(ByteRange {
                start: 0,
                end_inclusive: 1
            })
        );
    }
}
