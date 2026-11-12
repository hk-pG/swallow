//! CLI for reproducible library performance benchmarks (list / import).
//! Not linked into the desktop app; invoked via `cargo run --bin swallow_perf`.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Instant;

use item::ItemMetadata;
use serde::Serialize;
use swallow_lib::{import, item, library};

const DEFAULT_SEED: u64 = 42;
const TINY_PNG: &[u8] = &[
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SampleStats {
    runs_ms: Vec<f64>,
    median_ms: f64,
    min_ms: f64,
    max_ms: f64,
}

fn median_ms(samples: &mut [f64]) -> SampleStats {
    samples.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median = if samples.is_empty() {
        0.0
    } else {
        samples[samples.len() / 2]
    };
    let min = samples.first().copied().unwrap_or(0.0);
    let max = samples.last().copied().unwrap_or(0.0);
    SampleStats {
        runs_ms: samples.to_vec(),
        median_ms: median,
        min_ms: min,
        max_ms: max,
    }
}

/// Deterministic id: 26 alphanumeric chars (ULID-ish length).
fn perf_item_id(index: u32) -> String {
    format!("PERF{:022}", index)
}

fn write_perf_item(
    library_path: &Path,
    index: u32,
    seed: u64,
) -> Result<(), Box<dyn std::error::Error>> {
    let id = perf_item_id(index);
    let tag_bucket = index % 100;
    let created = i64::from(index) * 1_000 + i64::try_from(seed).unwrap_or(0);
    let item = ItemMetadata {
        id: id.clone(),
        name: format!("asset-{index:05}"),
        ext: "png".into(),
        size: TINY_PNG.len() as u64,
        width: Some(1),
        height: Some(1),
        tags: vec![format!("tag{tag_bucket:02}"), "benchmark".into()],
        folders: Vec::new(),
        annotation: if index % 11 == 0 {
            format!("findsample-{index}")
        } else {
            String::new()
        },
        star: u8::try_from(index % 6).unwrap_or(0),
        color_label: None,
        url: None,
        created_at: created,
        modified_at: created,
        is_deleted: false,
    };
    let dir = item::item_dir(library_path, &id);
    fs::create_dir_all(&dir)?;
    let meta_path = dir.join(item::ITEM_METADATA_FILE);
    library::write_json_atomic(&meta_path, &item)?;
    let file = item::item_file(&dir, &item)?;
    fs::write(file, TINY_PNG)?;
    Ok(())
}

fn cmd_generate(count: u32, seed: u64, out: &Path) -> Result<(), Box<dyn std::error::Error>> {
    if out.exists() {
        fs::remove_dir_all(out)?;
    }
    fs::create_dir_all(out)?;
    library::create(out)?;
    for i in 0..count {
        write_perf_item(out, i, seed)?;
    }
    eprintln!("generated {count} items at {}", out.display());
    Ok(())
}

fn cmd_export_json(library_path: &Path, out: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let items = item::read_items(library_path)?;
    let json = serde_json::to_vec(&items)?;
    if let Some(parent) = out.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(out, json)?;
    eprintln!("exported {} items to {}", items.len(), out.display());
    Ok(())
}

fn cmd_bench_list(library_path: &Path, runs: u32) -> Result<(), Box<dyn std::error::Error>> {
    let mut samples = Vec::with_capacity(runs as usize);
    for _ in 0..runs {
        let start = Instant::now();
        let items = item::read_items(library_path)?;
        let elapsed = start.elapsed().as_secs_f64() * 1000.0;
        samples.push(elapsed);
        // keep optimizer from dropping read
        std::hint::black_box(items.len());
    }
    let stats = median_ms(&mut samples);
    let count = item::read_items(library_path)?.len();
    let out = serde_json::json!({
      "scenario": "rust_list_items",
      "itemCount": count,
      "stats": stats,
    });
    println!("{}", serde_json::to_string(&out)?);
    Ok(())
}

fn staging_import_files(
    staging: &Path,
    count: u32,
    seed: u64,
    start_index: u32,
) -> Result<Vec<PathBuf>, Box<dyn std::error::Error>> {
    fs::create_dir_all(staging)?;
    let mut paths = Vec::with_capacity(count as usize);
    for i in 0..count {
        let idx = start_index + i;
        let name = format!("import-{idx:06}-s{seed}.png");
        let path = staging.join(&name);
        fs::write(&path, TINY_PNG)?;
        paths.push(path);
    }
    Ok(paths)
}

fn cmd_bench_import(
    library_path: &Path,
    import_count: u32,
    seed: u64,
    runs: u32,
    start_index: u32,
) -> Result<(), Box<dyn std::error::Error>> {
    let staging = library_path.join(".perf-import-staging");
    let mut samples = Vec::with_capacity(runs as usize);
    for run in 0..runs {
        let paths = staging_import_files(
            &staging,
            import_count,
            seed.wrapping_add(u64::from(run)),
            start_index.wrapping_add(import_count * run),
        )?;
        let start = Instant::now();
        let report = import::import_files(library_path, &paths)?;
        let elapsed = start.elapsed().as_secs_f64() * 1000.0;
        samples.push(elapsed);
        for p in &paths {
            let _ = fs::remove_file(p);
        }
        std::hint::black_box(report.imported.len());
    }
    let _ = fs::remove_dir_all(&staging);
    let stats = median_ms(&mut samples);
    let out = serde_json::json!({
      "scenario": "rust_import_files",
      "importCount": import_count,
      "stats": stats,
    });
    println!("{}", serde_json::to_string(&out)?);
    Ok(())
}

fn parse_u32(flag: &str, args: &[String], idx: &mut usize) -> Result<u32, String> {
    *idx += 1;
    let v = args
        .get(*idx)
        .ok_or_else(|| format!("missing value for {flag}"))?;
    v.parse()
        .map_err(|_| format!("invalid number for {flag}: {v}"))
}

fn parse_u64(flag: &str, args: &[String], idx: &mut usize) -> Result<u64, String> {
    *idx += 1;
    let v = args
        .get(*idx)
        .ok_or_else(|| format!("missing value for {flag}"))?;
    v.parse()
        .map_err(|_| format!("invalid number for {flag}: {v}"))
}

fn parse_path(flag: &str, args: &[String], idx: &mut usize) -> Result<PathBuf, String> {
    *idx += 1;
    args.get(*idx)
        .map(PathBuf::from)
        .ok_or_else(|| format!("missing value for {flag}"))
}

fn usage() {
    eprintln!(
        "swallow_perf — library perf helpers\n\
\n\
  swallow_perf generate --count N --out DIR [--seed S]\n\
  swallow_perf export-json --library DIR --out FILE\n\
  swallow_perf bench list --library DIR [--runs N]\n\
  swallow_perf bench import --library DIR --count N [--runs N] [--seed S] [--start-index N]\n"
    );
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        usage();
        std::process::exit(1);
    }
    let result = match args[1].as_str() {
        "generate" => {
            let mut count = 0u32;
            let mut seed = DEFAULT_SEED;
            let mut out = None::<PathBuf>;
            let mut i = 2;
            while i < args.len() {
                match args[i].as_str() {
                    "--count" => count = parse_u32("--count", &args, &mut i).unwrap(),
                    "--seed" => seed = parse_u64("--seed", &args, &mut i).unwrap(),
                    "--out" => out = Some(parse_path("--out", &args, &mut i).unwrap()),
                    _ => {
                        eprintln!("unknown arg: {}", args[i]);
                        std::process::exit(1);
                    }
                }
                i += 1;
            }
            let out = out.expect("--out required");
            cmd_generate(count, seed, &out)
        }
        "export-json" => {
            let mut library = None;
            let mut out = None;
            let mut i = 2;
            while i < args.len() {
                match args[i].as_str() {
                    "--library" => library = Some(parse_path("--library", &args, &mut i).unwrap()),
                    "--out" => out = Some(parse_path("--out", &args, &mut i).unwrap()),
                    _ => {
                        eprintln!("unknown arg: {}", args[i]);
                        std::process::exit(1);
                    }
                }
                i += 1;
            }
            cmd_export_json(&library.expect("--library"), &out.expect("--out"))
        }
        "bench" if args.get(2).is_some_and(|s| s == "list") => {
            let mut library = None;
            let mut runs = 5u32;
            let mut i = 3;
            while i < args.len() {
                match args[i].as_str() {
                    "--library" => library = Some(parse_path("--library", &args, &mut i).unwrap()),
                    "--runs" => runs = parse_u32("--runs", &args, &mut i).unwrap(),
                    _ => {
                        eprintln!("unknown arg: {}", args[i]);
                        std::process::exit(1);
                    }
                }
                i += 1;
            }
            cmd_bench_list(&library.expect("--library"), runs)
        }
        "bench" if args.get(2).is_some_and(|s| s == "import") => {
            let mut library = None;
            let mut count = 0u32;
            let mut runs = 3u32;
            let mut seed = DEFAULT_SEED;
            let mut start_index = 10_000_000u32;
            let mut i = 3;
            while i < args.len() {
                match args[i].as_str() {
                    "--library" => library = Some(parse_path("--library", &args, &mut i).unwrap()),
                    "--count" => count = parse_u32("--count", &args, &mut i).unwrap(),
                    "--runs" => runs = parse_u32("--runs", &args, &mut i).unwrap(),
                    "--seed" => seed = parse_u64("--seed", &args, &mut i).unwrap(),
                    "--start-index" => {
                        start_index = parse_u32("--start-index", &args, &mut i).unwrap()
                    }
                    _ => {
                        eprintln!("unknown arg: {}", args[i]);
                        std::process::exit(1);
                    }
                }
                i += 1;
            }
            cmd_bench_import(&library.expect("--library"), count, seed, runs, start_index)
        }
        _ => {
            usage();
            std::process::exit(1);
        }
    };
    if let Err(err) = result {
        let mut stderr = std::io::stderr();
        let _ = writeln!(stderr, "error: {err}");
        std::process::exit(1);
    }
}
