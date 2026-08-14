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

use printpdf::path::PaintMode;
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
  /// Lysere fyll-tone av makkergruppe-fargen (allerede blandet mot hvitt av
  /// JS-siden via `lightenHex`) - `None`/fravær betyr standard lys grå fyll
  /// (`#f1f5f9`), speiler "Fargelegg pulter"-bryteren i print-modalen.
  #[serde(default)]
  pub fill_color_hex: Option<String>,
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

// ---------------------------------------------------------------------------
// Task 6.2: PDF rendering geometry + drawing.
// ---------------------------------------------------------------------------
//
// Mirrors `PrintPage.jsx` (page/margin/header/footer geometry) and
// `printLayouts/printGeometry.js` (content-area size + centering offset,
// which is already baked into the `PrintPayload` coordinates by the JS
// payload builder — see Task 6.1). All constants below are copy-identical to
// those two JS files; if either changes, mirror the change here too.

/// Physical A4-landscape page size in millimeters.
const PAGE_W_MM: f64 = 297.0;
const PAGE_H_MM: f64 = 210.0;
/// Margin on all sides, header band, footer band (all inside the margin),
/// exactly as `PrintPage.jsx`'s `MARGIN_MM` / `HEADER_MM` / `FOOTER_MM`.
const MARGIN_MM: f64 = 10.0;
const HEADER_MM: f64 = 18.0;
const FOOTER_MM: f64 = 10.0;
/// Same "virtual px assumes ~96dpi" conversion constant as the JS's
/// `MM_TO_PX` in `PrintPage.jsx`.
const MM_TO_PX: f64 = 3.7795;
/// The virtual canvas the JS lays desks/board out on before scaling down to
/// fit the page (`CONTENT_WIDTH_PX`/`CONTENT_HEIGHT_PX` in printGeometry.js).
const CONTENT_WIDTH_PX: f64 = 1100.0;
const CONTENT_HEIGHT_PX: f64 = 700.0;
/// 1mm in PDF points, used to convert our "virtual px -> mm" font sizes into
/// the pt unit `use_text` expects.
const MM_TO_PT: f64 = 2.8346;

/// Mirrors `getPrintableAreaPx()`: the content area's available width/height
/// in virtual px, after subtracting margins/header/footer and converting mm
/// -> px via `MM_TO_PX`.
fn printable_area_px() -> (f64, f64) {
  let width = (PAGE_W_MM - MARGIN_MM * 2.0) * MM_TO_PX;
  let height = (PAGE_H_MM - MARGIN_MM * 2.0 - HEADER_MM - FOOTER_MM) * MM_TO_PX;
  (width, height)
}

/// Mirrors `computePrintScale()`: scale DOWN (never up) so the fixed
/// 1100x700 virtual content box fits inside the printable area.
fn compute_print_scale() -> f64 {
  let (area_w, area_h) = printable_area_px();
  let sx = area_w / CONTENT_WIDTH_PX;
  let sy = area_h / CONTENT_HEIGHT_PX;
  1.0_f64.min(sx).min(sy)
}

/// Converts a virtual-px length (desk width, font size, etc.) into mm, after
/// applying the print scale factor. This is the single conversion both
/// coordinates AND font sizes are chained through, per Task 6.2 instructions
/// (no hardcoded pt sizes).
fn px_to_mm(px: f64, scale: f64) -> f64 {
  (px * scale) / MM_TO_PX
}

/// Converts a virtual-px length straight to PDF points (mm -> pt), for font
/// sizes. Chains through the same scale factor as coordinates so text scales
/// proportionally with everything else on the page.
fn px_to_pt(px: f64, scale: f64) -> f64 {
  px_to_mm(px, scale) * MM_TO_PT
}

/// Content-area top-left origin, in mm, measured from the page's top-left
/// (CSS-style, Y-down) — i.e. margin + header band.
const CONTENT_ORIGIN_TOP_MM: f64 = MARGIN_MM + HEADER_MM;
const CONTENT_ORIGIN_LEFT_MM: f64 = MARGIN_MM;

/// Converts a top-left-origin/Y-down (content_x, content_y) point, in virtual
/// px within the 1100x700 content box, into a printpdf bottom-left-origin/
/// Y-up (Mm, Mm) point on the physical page. Returns `f32` (matching
/// printpdf's `Mm(pub f32)`), computed via `f64` internally for precision.
fn content_px_to_page_mm(content_x_px: f64, content_y_px: f64, scale: f64) -> (Mm, Mm) {
  let x_mm = CONTENT_ORIGIN_LEFT_MM + px_to_mm(content_x_px, scale);
  let y_from_top_mm = CONTENT_ORIGIN_TOP_MM + px_to_mm(content_y_px, scale);
  let y_from_bottom_mm = PAGE_H_MM - y_from_top_mm;
  (Mm(x_mm as f32), Mm(y_from_bottom_mm as f32))
}

/// Parses a `#rrggbb` (or `#rgb`) hex string into a printpdf RGB `Color`.
/// Falls back to black on malformed input rather than failing the whole
/// render over a single bad color string (defensive — the JS side always
/// sends well-formed hex, but this is cheap insurance).
fn hex_to_color(hex: &str) -> Color {
  let (r, g, b) = hex_to_rgb_u8(hex);
  Color::Rgb(Rgb::new(
    r as f32 / 255.0,
    g as f32 / 255.0,
    b as f32 / 255.0,
    None,
  ))
}

fn hex_to_rgb_u8(hex: &str) -> (u8, u8, u8) {
  let h = hex.trim_start_matches('#');
  let expand = |c: char| -> String { [c, c].iter().collect() };
  let (rs, gs, bs) = if h.len() == 3 {
    let chars: Vec<char> = h.chars().collect();
    (expand(chars[0]), expand(chars[1]), expand(chars[2]))
  } else if h.len() == 6 {
    (h[0..2].to_string(), h[2..4].to_string(), h[4..6].to_string())
  } else {
    return (0, 0, 0);
  };
  let r = u8::from_str_radix(&rs, 16).unwrap_or(0);
  let g = u8::from_str_radix(&gs, 16).unwrap_or(0);
  let b = u8::from_str_radix(&bs, 16).unwrap_or(0);
  (r, g, b)
}

/// Very rough average-glyph-width heuristic for the built-in Helvetica
/// metrics (~0.5em per character for regular weight, ~0.55em for bold),
/// used only to horizontally center short text labels (desk names, seat
/// numbers, zone chips, "TAVLE", header/footer text). printpdf's built-in
/// fonts don't expose per-glyph width lookups, and pulling in a full AFM
/// metrics table for this cosmetic centering would be disproportionate
/// effort for a faithful-but-not-pixel-perfect port — documented
/// simplification, see Task 6.2 report.
fn approx_text_width_mm(text: &str, font_size_pt: f64, bold: bool) -> f64 {
  let factor = if bold { 0.55 } else { 0.5 };
  let width_pt = text.chars().count() as f64 * font_size_pt * factor;
  width_pt / MM_TO_PT
}

/// Draws a plain rectangle (no rounded corners — printpdf's `Rect` type has
/// no radius support, and hand-rolling bezier-cornered rects for this
/// cosmetic detail isn't worth the complexity here; see Task 6.2 report).
/// `mode` controls fill/stroke/both.
fn draw_rect(
  layer: &PdfLayerReference,
  ll: (Mm, Mm),
  ur: (Mm, Mm),
  fill: Option<Color>,
  outline: Option<Color>,
  outline_thickness_pt: f32,
  mode: PaintMode,
) {
  if let Some(c) = fill {
    layer.set_fill_color(c);
  }
  if let Some(c) = outline {
    layer.set_outline_color(c);
  }
  layer.set_outline_thickness(outline_thickness_pt);
  let rect = Rect::new(ll.0, ll.1, ur.0, ur.1).with_mode(mode);
  layer.add_rect(rect);
}

/// Draws a horizontally-centered text label. `center_x_mm`/`baseline_y_mm`
/// are in page mm (bottom-left origin, matching printpdf's coordinate
/// system, i.e. already converted via `content_px_to_page_mm`).
#[allow(clippy::too_many_arguments)]
fn draw_centered_text(
  layer: &PdfLayerReference,
  font: &IndirectFontRef,
  text: &str,
  center_x_mm: f32,
  baseline_y_mm: f32,
  font_size_pt: f64,
  bold: bool,
  color: Color,
) {
  layer.set_fill_color(color);
  let w = approx_text_width_mm(text, font_size_pt, bold);
  let x = center_x_mm - (w / 2.0) as f32;
  layer.use_text(text, font_size_pt as f32, Mm(x), Mm(baseline_y_mm), font);
}

/// Fonts bundled once per render, reused for every text draw call.
struct Fonts {
  regular: IndirectFontRef,
  bold: IndirectFontRef,
}

/// Renders a seating-chart `PrintPayload` to a single-page A4-landscape PDF
/// at `output_path`. See module doc + Task 6.2 for the geometry contract
/// this must replicate exactly from `PrintPage.jsx` / `printGeometry.js`.
pub fn render_seating_chart_pdf(payload: &PrintPayload, output_path: &str) -> Result<(), String> {
  let (doc, page1, layer1) = PdfDocument::new(
    if payload.chart_name.is_empty() {
      "Klassekart"
    } else {
      &payload.chart_name
    },
    Mm(PAGE_W_MM as f32),
    Mm(PAGE_H_MM as f32),
    "Innhold",
  );
  let layer = doc.get_page(page1).get_layer(layer1);

  let fonts = Fonts {
    regular: doc
      .add_builtin_font(BuiltinFont::Helvetica)
      .map_err(|e| e.to_string())?,
    bold: doc
      .add_builtin_font(BuiltinFont::HelveticaBold)
      .map_err(|e| e.to_string())?,
  };

  let scale = compute_print_scale();

  draw_header(&layer, &fonts, payload);
  draw_footer(&layer, &fonts);
  draw_board(&layer, &fonts, &payload.board, scale);
  for desk in &payload.desks {
    draw_desk(&layer, &fonts, desk, scale);
  }

  doc
    .save(&mut BufWriter::new(
      File::create(output_path).map_err(|e| e.to_string())?,
    ))
    .map_err(|e| e.to_string())?;
  Ok(())
}

/// Header: chart name (large, bold) + optional period subtitle, at the top
/// of the page within the margin+header band. A 2px-equivalent rule under
/// the header band, matching the JS's `border-bottom: 2px solid #333`.
fn draw_header(layer: &PdfLayerReference, fonts: &Fonts, payload: &PrintPayload) {
  let title_x = Mm((MARGIN_MM + 2.0) as f32);
  let title_y = Mm((PAGE_H_MM - MARGIN_MM - 8.0) as f32);
  let title = if payload.chart_name.is_empty() {
    "Klassekart"
  } else {
    &payload.chart_name
  };
  layer.set_fill_color(hex_to_color("#111111"));
  layer.use_text(title, 22.0, title_x, title_y, &fonts.bold);

  if !payload.period_text.is_empty() {
    let sub_y = Mm((PAGE_H_MM - MARGIN_MM - 14.0) as f32);
    layer.set_fill_color(hex_to_color("#555555"));
    layer.use_text(&payload.period_text, 12.0, title_x, sub_y, &fonts.regular);
  }

  // Rule under the header band (nice-to-have, cheap with printpdf's Rect).
  let rule_y = (PAGE_H_MM - MARGIN_MM - HEADER_MM) as f32;
  draw_rect(
    layer,
    (Mm(MARGIN_MM as f32), Mm(rule_y - 0.15)),
    (Mm((PAGE_W_MM - MARGIN_MM) as f32), Mm(rule_y + 0.15)),
    Some(hex_to_color("#333333")),
    None,
    0.0,
    PaintMode::Fill,
  );
}

/// Footer: two-tone "KlassePlass" wordmark, bottom-right of the page.
fn draw_footer(layer: &PdfLayerReference, fonts: &Fonts) {
  let y = Mm((MARGIN_MM + 3.0) as f32);
  let klasse = "Klasse";
  let plass = "Plass";
  let font_size = 9.0;
  let klasse_w = approx_text_width_mm(klasse, font_size, true) as f32;
  let plass_w = approx_text_width_mm(plass, font_size, true) as f32;
  let right_edge = (PAGE_W_MM - MARGIN_MM) as f32;
  let klasse_x = right_edge - klasse_w - plass_w;
  let plass_x = right_edge - plass_w;

  layer.set_fill_color(hex_to_color("#111111"));
  layer.use_text(klasse, font_size as f32, Mm(klasse_x), y, &fonts.bold);
  layer.set_fill_color(hex_to_color("#f59e0b"));
  layer.use_text(plass, font_size as f32, Mm(plass_x), y, &fonts.bold);
}

/// Board: bordered rect containing centered "TAVLE" text.
fn draw_board(layer: &PdfLayerReference, fonts: &Fonts, board: &PrintBoard, scale: f64) {
  let (ll_x, top_mm) = content_px_to_page_mm(board.x, board.y, scale);
  let (ur_x, bottom_mm) = content_px_to_page_mm(board.x + BOARD_W, board.y + BOARD_H, scale);
  draw_rect(
    layer,
    (ll_x, bottom_mm),
    (ur_x, top_mm),
    None,
    Some(hex_to_color("#374151")),
    1.0,
    PaintMode::Stroke,
  );

  let center_x = (ll_x.0 + ur_x.0) / 2.0;
  let center_y = (top_mm.0 + bottom_mm.0) / 2.0 - px_to_mm(4.0, scale) as f32; // rough vertical-center nudge
  let font_size = px_to_pt(11.0, scale);
  draw_centered_text(
    layer,
    &fonts.bold,
    "TAVLE",
    center_x,
    center_y,
    font_size,
    true,
    hex_to_color("#374151"),
  );
}

/// Desk: filled+bordered rect, per-seat-slot name/number, optional zone
/// chips below.
fn draw_desk(layer: &PdfLayerReference, fonts: &Fonts, desk: &PrintDesk, scale: f64) {
  let cap = desk.capacity.max(1);
  let desk_w_px = cap as f64 * 100.0;

  let (ll_x, top_mm) = content_px_to_page_mm(desk.x, desk.y, scale);
  let (ur_x, bottom_mm) = content_px_to_page_mm(desk.x + desk_w_px, desk.y + DESK_H, scale);

  // Fill, then stroke on top (two passes — printpdf's PaintMode::FillStroke
  // uses a single color for both, but the JS uses different fill/border
  // colors, so we draw fill first, border second).
  let fill_color = desk
    .fill_color_hex
    .as_deref()
    .map(hex_to_color)
    .unwrap_or_else(|| hex_to_color("#f1f5f9"));
  draw_rect(
    layer,
    (ll_x, bottom_mm),
    (ur_x, top_mm),
    Some(fill_color),
    None,
    0.0,
    PaintMode::Fill,
  );
  draw_rect(
    layer,
    (ll_x, bottom_mm),
    (ur_x, top_mm),
    None,
    Some(hex_to_color(&desk.border_color_hex)),
    2.0,
    PaintMode::Stroke,
  );

  // Seat slots: cap equal-width columns across the desk.
  let slot_w_px = desk_w_px / cap as f64;
  let name_font_size = px_to_pt(11.0, scale);
  let number_font_size = px_to_pt(10.0, scale);
  let name_baseline_y = (top_mm.0 + bottom_mm.0) / 2.0 - px_to_mm(4.0, scale) as f32;

  for (idx, seat) in desk.seats.iter().enumerate() {
    if idx as u32 >= cap {
      break; // defensive: payload should never have more seats than capacity
    }
    let slot_center_x_px = desk.x + slot_w_px * (idx as f64 + 0.5);
    let (slot_center_x_mm, _) = content_px_to_page_mm(slot_center_x_px, desk.y, scale);

    match &seat.student_name {
      Some(name) => {
        draw_centered_text(
          layer,
          &fonts.bold,
          name,
          slot_center_x_mm.0,
          name_baseline_y,
          name_font_size,
          true,
          hex_to_color("#111111"),
        );
      }
      None => {
        // Empty-slot placeholder, drawn lighter to approximate the JS's
        // `opacity: 0.25` (printpdf has no opacity/alpha support for fills
        // without extended graphics state gymnastics, so we approximate
        // with a light gray instead — documented simplification).
        draw_centered_text(
          layer,
          &fonts.bold,
          "\u{2014}", // em-dash
          slot_center_x_mm.0,
          name_baseline_y,
          name_font_size,
          true,
          hex_to_color("#cccccc"),
        );
      }
    }

    if let Some(n) = seat.seat_number {
      // JS positions the number at `top: -14px, left: -2px` relative to the
      // slot's top-left corner.
      let number_x_px = desk.x + slot_w_px * idx as f64 - 2.0;
      let number_y_px = desk.y - 14.0;
      let (number_x_mm, number_y_mm) = content_px_to_page_mm(number_x_px, number_y_px, scale);
      layer.set_fill_color(hex_to_color("#555555"));
      layer.use_text(
        n.to_string(),
        number_font_size as f32,
        number_x_mm,
        number_y_mm,
        &fonts.bold,
      );
    }
  }

  // Zone chips: laid out left-to-right below the desk (simplified from the
  // JS's centered flex-wrap row — a single left-to-right row covers the
  // common case of a handful of short zone labels; see Task 6.2 report).
  if !desk.zone_chips.is_empty() {
    let chip_font_size = px_to_pt(7.0, scale);
    let chip_gap_mm = px_to_mm(2.0, scale) as f32;
    let chip_pad_mm = px_to_mm(4.0, scale) as f32;
    let mut cursor_x_mm = ll_x.0;
    let chip_y_top_mm = bottom_mm.0 - px_to_mm(4.0, scale) as f32; // marginTop: 4px below desk
    let chip_h_mm = px_to_mm(11.0, scale) as f32;
    let chip_y_bottom_mm = chip_y_top_mm - chip_h_mm;
    let text_baseline_mm = chip_y_bottom_mm + chip_h_mm * 0.3;

    for chip in &desk.zone_chips {
      let color = hex_to_color(&chip.color_hex);
      let text_w_mm = approx_text_width_mm(&chip.label, chip_font_size, true) as f32;
      let chip_w_mm = text_w_mm + chip_pad_mm * 2.0;

      draw_rect(
        layer,
        (Mm(cursor_x_mm), Mm(chip_y_bottom_mm)),
        (Mm(cursor_x_mm + chip_w_mm), Mm(chip_y_top_mm)),
        None,
        Some(color.clone()),
        0.5,
        PaintMode::Stroke,
      );
      layer.set_fill_color(color);
      layer.use_text(
        &chip.label,
        chip_font_size as f32,
        Mm(cursor_x_mm + chip_pad_mm),
        Mm(text_baseline_mm),
        &fonts.bold,
      );

      cursor_x_mm += chip_w_mm + chip_gap_mm;
    }
  }
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

    // fillColorHex mangler i fixturen over - må ikke feile deserialisering,
    // og skal falle tilbake til None (draw_desk bruker da standard #f1f5f9).
    assert_eq!(desk0.fill_color_hex, None);
  }

  #[test]
  fn print_desk_deserializes_fill_color_hex_when_present() {
    let json = r##"{
      "x": 0, "y": 0, "capacity": 1, "borderColorHex": "#2563eb",
      "fillColorHex": "#c7d9f7",
      "seats": [], "zoneChips": []
    }"##;
    let desk: PrintDesk = serde_json::from_str(json).expect("desk should deserialize");
    assert_eq!(desk.fill_color_hex.as_deref(), Some("#c7d9f7"));
  }

  // ---------------------------------------------------------------------
  // Task 6.2: geometry/scale math unit tests (pure functions, hand-checked
  // against the JS formulas in PrintPage.jsx / printGeometry.js).
  // ---------------------------------------------------------------------

  #[test]
  fn printable_area_matches_hand_calculation() {
    // width = (297 - 2*10) * 3.7795 = 277 * 3.7795 = 1046.9215
    // height = (210 - 2*10 - 18 - 10) * 3.7795 = 162 * 3.7795 = 612.279
    let (w, h) = printable_area_px();
    assert!((w - 1046.9215).abs() < 0.01, "width was {w}");
    assert!((h - 612.279).abs() < 0.01, "height was {h}");
  }

  #[test]
  fn compute_print_scale_matches_js_formula() {
    // scale = min(1, 1046.9215/1100, 612.279/700) = min(1, 0.951747, 0.874684)
    let scale = compute_print_scale();
    assert!((scale - 0.874684).abs() < 0.001, "scale was {scale}");
    // Sanity: never scales up.
    assert!(scale <= 1.0);
  }

  #[test]
  fn px_to_mm_applies_scale_and_mm_to_px_conversion() {
    let scale = compute_print_scale();
    // 100px * scale / 3.7795, hand-computed for a known scale value.
    let expected = (100.0 * scale) / MM_TO_PX;
    assert_eq!(px_to_mm(100.0, scale), expected);
    // At scale=1 (hypothetically), 37.795px should be exactly 10mm.
    assert!((px_to_mm(37.795, 1.0) - 10.0).abs() < 1e-9);
  }

  #[test]
  fn content_px_to_page_mm_places_origin_at_margin_plus_header_top_left() {
    // content (0,0) -> top-left of the content area: x = MARGIN_MM = 10mm
    // from the left; y (from bottom) = PAGE_H_MM - (MARGIN_MM+HEADER_MM) =
    // 210 - 28 = 182mm from the bottom.
    let (x, y) = content_px_to_page_mm(0.0, 0.0, 1.0);
    assert!((x.0 - 10.0).abs() < 1e-4, "x was {}", x.0);
    assert!((y.0 - 182.0).abs() < 1e-4, "y was {}", y.0);
  }

  #[test]
  fn content_px_to_page_mm_moves_down_as_content_y_increases() {
    // Increasing content_y (Y-down, CSS-style) must DECREASE the page's
    // bottom-left-origin Y (Y-up) — this is the top-left -> bottom-left flip.
    let scale = compute_print_scale();
    let (_, y_top) = content_px_to_page_mm(0.0, 0.0, scale);
    let (_, y_lower) = content_px_to_page_mm(0.0, 100.0, scale);
    assert!(y_lower.0 < y_top.0, "expected {} < {}", y_lower.0, y_top.0);
  }

  #[test]
  fn all_reference_payload_coordinates_land_within_page_bounds() {
    // Sanity check per Task 6.2 instructions: verify computed mm values for
    // every desk/board corner in the sample payload fall within the [0,297]
    // x [0,210] physical page, so nothing is drawn off-page.
    let payload: PrintPayload = serde_json::from_str(SAMPLE_PAYLOAD_JSON).unwrap();
    let scale = compute_print_scale();
    let check = |x_px: f64, y_px: f64| {
      let (x, y) = content_px_to_page_mm(x_px, y_px, scale);
      assert!(
        x.0 >= 0.0 && x.0 <= PAGE_W_MM as f32,
        "x {} out of [0,{}]",
        x.0,
        PAGE_W_MM
      );
      assert!(
        y.0 >= 0.0 && y.0 <= PAGE_H_MM as f32,
        "y {} out of [0,{}]",
        y.0,
        PAGE_H_MM
      );
    };
    check(payload.board.x, payload.board.y);
    check(payload.board.x + BOARD_W, payload.board.y + BOARD_H);
    for desk in &payload.desks {
      let w = desk.capacity as f64 * 100.0;
      check(desk.x, desk.y);
      check(desk.x + w, desk.y + DESK_H);
    }
  }

  #[test]
  fn hex_to_rgb_u8_parses_six_and_three_digit_hex() {
    assert_eq!(hex_to_rgb_u8("#2563eb"), (0x25, 0x63, 0xeb));
    assert_eq!(hex_to_rgb_u8("#fff"), (0xff, 0xff, 0xff));
    assert_eq!(hex_to_rgb_u8("#000000"), (0, 0, 0));
    // malformed input falls back to black rather than panicking.
    assert_eq!(hex_to_rgb_u8("not-a-color"), (0, 0, 0));
  }

  // ---------------------------------------------------------------------
  // Task 6.2: integration-style render test + pdftotext content check.
  // ---------------------------------------------------------------------

  #[test]
  fn render_seating_chart_pdf_writes_a_nonempty_file() {
    let payload: PrintPayload = serde_json::from_str(SAMPLE_PAYLOAD_JSON).unwrap();
    let dir = tempfile::tempdir().expect("tempdir");
    let path = dir.path().join("klassekart.pdf");
    let path_str = path.to_str().unwrap();

    render_seating_chart_pdf(&payload, path_str).expect("render should succeed");

    let meta = std::fs::metadata(&path).expect("output file should exist");
    assert!(meta.len() > 0, "output PDF should be nonempty");
  }

  #[test]
  fn render_seating_chart_pdf_text_is_extractable_and_correct() {
    // Strong, cheap correctness signal per Task 6.2 instructions: run
    // pdftotext over the rendered PDF and confirm the real content we
    // expect (chart name, period text, board label, student name, empty
    // slot dash, zone chip label) actually made it into the PDF's text
    // layer at all, which only happens if use_text() calls succeeded with
    // in-bounds coordinates.
    let payload: PrintPayload = serde_json::from_str(SAMPLE_PAYLOAD_JSON).unwrap();
    let dir = tempfile::tempdir().expect("tempdir");
    let pdf_path = dir.path().join("klassekart.pdf");
    render_seating_chart_pdf(&payload, pdf_path.to_str().unwrap()).expect("render");

    let output = std::process::Command::new("pdftotext")
      .arg("-enc")
      .arg("UTF-8")
      .arg(pdf_path.to_str().unwrap())
      .arg("-") // stdout
      .output();

    let output = match output {
      Ok(o) => o,
      Err(_) => {
        eprintln!("pdftotext not available on this machine, skipping text-extraction assertions");
        return;
      }
    };
    assert!(output.status.success(), "pdftotext should succeed");
    let text = String::from_utf8_lossy(&output.stdout);

    assert!(text.contains("1ST5"), "chart name missing: {text}");
    assert!(text.contains("Vår 2026"), "period text missing: {text}");
    assert!(text.contains("TAVLE"), "board label missing: {text}");
    assert!(text.contains("Ola Nordmann"), "student name missing: {text}");
    assert!(text.contains("STILLE"), "zone chip label missing: {text}");
    assert!(text.contains("KlassePlass") || (text.contains("Klasse") && text.contains("Plass")),
      "footer wordmark missing: {text}");
    // Empty-slot em-dash placeholder.
    assert!(text.contains('\u{2014}'), "empty-slot dash missing: {text}");
  }

  #[test]
  #[ignore] // manual-verification-only: writes a real PDF to a fixed path for eyeballing/pdftotext, not part of `cargo test`
  fn manual_verification_render_to_scratch_path() {
    let payload: PrintPayload = serde_json::from_str(SAMPLE_PAYLOAD_JSON).unwrap();
    let path = std::env::var("MANUAL_PDF_OUT").unwrap_or_else(|_| "manual_check.pdf".to_string());
    render_seating_chart_pdf(&payload, &path).expect("render should succeed");
    println!("wrote {path}");
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
