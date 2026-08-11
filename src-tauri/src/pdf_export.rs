//! Rust-native PDF export for seating-chart printing (replaces Electron's
//! `webContents.printToPDF()`), built across Task 6.1-6.3:
//!   - 6.1 (this file, current state): the data contract — `PrintPayload` /
//!     `PrintDesk` / `PrintSeat` / `ZoneChip` structs that mirror the JSON
//!     produced by `buildSeatingChartPrintPayload` in
//!     `src/components/Print/printLayouts/buildSeatingChartPrintPayload.js`.
//!   - 6.2: actual PDF rendering (geometry + drawing) from a `PrintPayload`.
//!   - 6.3: wiring into the `exportPrintPdf` Tauri command.
//!
//! SCOPE: seatingChart only. The real Electron print system also supports
//! `station` (stasjonsplan) and `groupWork` (gruppeinndeling) content types,
//! each with their own, considerably more complex layout/pagination logic
//! (`StationPrintContent` / `GroupPrintContent`). Fully porting those to Rust
//! is out of scope for this phase — they keep working exactly as today via
//! the native OS print dialog (`window.print()`), which renders through the
//! webview and is completely unaffected by this module. The `exportPrintPdf`
//! Tauri command (Task 6.3) will only handle `contentType === "seatingChart"`
//! here; for `station`/`groupWork` it returns a "not implemented for this
//! content type yet" result, same as it already does today for all types.
//!
//! Constants below (`BOARD_W`/`BOARD_H`/`DESK_H`) mirror the JS-side
//! constants in `SeatingChartPrintContent.jsx` exactly and are intentionally
//! hardcoded here too, not data-driven — the JS payload builder already
//! resolves all business logic (student names, group colors, zone labels)
//! into these structs, so Rust only needs geometry/drawing logic against
//! fixed layout constants, never domain lookups.
//!
//! The spike command from Task 0.2 (`spike_generate_test_pdf`) is left in
//! place below — it's superseded by the real payload/rendering path but kept
//! as a minimal smoke test that the `printpdf` crate still works end to end.

use printpdf::*;
use serde::Deserialize;
use std::fs::File;
use std::io::BufWriter;

/// Desk width = capacity * 100px, board size, desk height — fixed layout
/// constants shared with `SeatingChartPrintContent.jsx` / the JS payload
/// builder. Not part of the payload since they never vary per-payload.
#[allow(dead_code)]
pub const BOARD_W: f64 = 256.0;
#[allow(dead_code)]
pub const BOARD_H: f64 = 36.0;
#[allow(dead_code)]
pub const DESK_H: f64 = 60.0;

/// One seat slot inside a desk. `student_name`/`seat_number` are `None` when
/// the slot is empty / numbers are switched off — the JS side has already
/// resolved this (see `buildSeatingChartPrintPayload`'s `showNumbers` gating
/// and empty-slot `null` handling), so Rust just renders "—" for `None`
/// student names (Task 6.2) rather than deciding anything itself.
#[derive(Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PrintSeat {
  pub student_name: Option<String>,
  pub seat_number: Option<u32>,
}

/// A zone "chip" rendered below a desk (e.g. "STILLE"), already resolved to
/// its final label + hex color by the JS side (zoneMeta lookup + showColors
/// gating + '#555' fallback already applied).
#[derive(Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ZoneChip {
  pub label: String,
  pub color_hex: String,
}

/// One desk, pre-baked and ready to draw: position already includes the
/// JS-side centering offset, border color already resolves the
/// groupOverrides-then-groupId-then-palette-index-then-showGroups/showColors
/// chain, zones already filtered by showZones.
#[derive(Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PrintDesk {
  pub x: f64,
  pub y: f64,
  pub capacity: u32,
  pub border_color_hex: String,
  pub seats: Vec<PrintSeat>,
  pub zone_chips: Vec<ZoneChip>,
}

/// Board position (already offset-adjusted by the JS side, same as desks).
#[derive(Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PrintBoard {
  pub x: f64,
  pub y: f64,
}

/// Top-level payload sent from JS (`buildSeatingChartPrintPayload`) to the
/// Rust `exportPrintPdf` command (Task 6.3) for `contentType === "seatingChart"`.
#[derive(Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PrintPayload {
  pub board: PrintBoard,
  pub desks: Vec<PrintDesk>,
  pub chart_name: String,
  pub period_text: String,
}

pub fn spike_generate_test_pdf(path: &str) -> Result<(), String> {
    let (doc, page1, layer1) = PdfDocument::new("Klassekart", Mm(297.0), Mm(210.0), "Layer 1");
    let layer = doc.get_page(page1).get_layer(layer1);
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| e.to_string())?;
    layer.use_text("Testbord 1", 14.0, Mm(20.0), Mm(190.0), &font);

    doc.save(&mut BufWriter::new(
        File::create(path).map_err(|e| e.to_string())?,
    ))
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  // Pasted verbatim from actually running buildSeatingChartPrintPayload() in
  // Node against a small fixture (two desks: one 2-seat with a placed
  // student + group color + zone chip, one 1-seat empty desk with default
  // border color) — this is the real shape the JS builder produces, not a
  // hand-guessed one, so a pass here means the two sides genuinely agree on
  // field names/shapes.
  const SAMPLE_PAYLOAD_JSON: &str = r##"
  {
    "board": { "x": 400, "y": 280 },
    "desks": [
      {
        "x": 400,
        "y": 360,
        "capacity": 2,
        "borderColorHex": "#2563eb",
        "seats": [
          { "studentName": "Ola Nordmann", "seatNumber": 1 },
          { "studentName": null, "seatNumber": 2 }
        ],
        "zoneChips": [
          { "label": "STILLE", "colorHex": "#7c3aed" }
        ]
      },
      {
        "x": 600,
        "y": 360,
        "capacity": 1,
        "borderColorHex": "#475569",
        "seats": [
          { "studentName": null, "seatNumber": 3 }
        ],
        "zoneChips": []
      }
    ],
    "chartName": "1ST5",
    "periodText": "1ST5 · Vår 2026"
  }
  "##;

  #[test]
  fn print_payload_deserializes_from_js_shaped_json() {
    let payload: PrintPayload =
      serde_json::from_str(SAMPLE_PAYLOAD_JSON).expect("payload should deserialize");

    assert_eq!(payload.board.x, 400.0);
    assert_eq!(payload.board.y, 280.0);
    assert_eq!(payload.chart_name, "1ST5");
    assert_eq!(payload.period_text, "1ST5 \u{b7} V\u{e5}r 2026");
    assert_eq!(payload.desks.len(), 2);

    let desk0 = &payload.desks[0];
    assert_eq!(desk0.capacity, 2);
    assert_eq!(desk0.border_color_hex, "#2563eb");
    assert_eq!(desk0.seats.len(), 2);
    assert_eq!(desk0.seats[0].student_name.as_deref(), Some("Ola Nordmann"));
    assert_eq!(desk0.seats[0].seat_number, Some(1));
    assert_eq!(desk0.seats[1].student_name, None);
    assert_eq!(desk0.seats[1].seat_number, Some(2));
    assert_eq!(desk0.zone_chips.len(), 1);
    assert_eq!(desk0.zone_chips[0].label, "STILLE");
    assert_eq!(desk0.zone_chips[0].color_hex, "#7c3aed");

    let desk1 = &payload.desks[1];
    assert_eq!(desk1.capacity, 1);
    assert_eq!(desk1.border_color_hex, "#475569");
    assert_eq!(desk1.seats[0].student_name, None);
    assert_eq!(desk1.zone_chips.len(), 0);
  }

  #[test]
  fn missing_optional_fields_still_required_but_null_ok() {
    // seatNumber/studentName being explicitly null (not omitted) is what the
    // JS builder always sends — confirm Option<T> handles that correctly.
    let json = r##"{
      "board": { "x": 0, "y": 0 },
      "desks": [{
        "x": 0, "y": 0, "capacity": 1, "borderColorHex": "#475569",
        "seats": [{ "studentName": null, "seatNumber": null }],
        "zoneChips": []
      }],
      "chartName": "",
      "periodText": ""
    }"##;
    let payload: PrintPayload = serde_json::from_str(json).expect("should deserialize");
    assert_eq!(payload.desks[0].seats[0].student_name, None);
    assert_eq!(payload.desks[0].seats[0].seat_number, None);
  }
}
