from openpyxl import Workbook
from openpyxl.styles import (Font, PatternFill, Alignment, Border, Side,
                              GradientFill)
from openpyxl.utils import get_column_letter
from dateutil.relativedelta import relativedelta
from datetime import date
import math

# ── Savills brand colors ──────────────────────────────────────────────────────
YELLOW   = "FEDE07"
DARK     = "1A2332"
MID_GRAY = "F2F2F2"
LIGHT    = "FFFFFF"
BORDER_C = "CCCCCC"

def side(style="thin", color=BORDER_C):
    return Side(style=style, color=color)

def all_border(style="thin"):
    s = side(style)
    return Border(left=s, right=s, top=s, bottom=s)

def cell_style(ws, cell_ref, value=None, bold=False, size=10, color="000000",
               bg=None, align="right", wrap=False, border=True, num_fmt=None):
    c = ws[cell_ref]
    if value is not None:
        c.value = value
    c.font = Font(name="Arial", bold=bold, size=size, color=color)
    if bg:
        c.fill = PatternFill("solid", fgColor=bg)
    c.alignment = Alignment(horizontal=align, vertical="center",
                             wrap_text=wrap)
    if border:
        c.border = all_border()
    if num_fmt:
        c.number_format = num_fmt
    return c

def build_annex(data: dict, output_path: str):
    """
    data keys:
      tenant_name   : str
      unit          : str
      project       : str
      lease_start   : date
      num_years     : int
      base_monthly  : float      (Year-1 monthly rent, EGP)
      escalation    : float      (e.g. 0.10 for 10%)
      sc_monthly_y1 : float      (Year-1 monthly SC, EGP)
      sc_escalation : float      (SC escalation rate, default same as rent)
      vat_rent      : float      (default 0.01)
      vat_sc        : float      (default 0.14)
      revenue_share_years : int  (0 = none, 1 = year-1 is RS at zero rent)
      area_sqm      : float | None
      sc_per_sqm    : float | None
    """
    tn    = data["tenant_name"]
    unit  = data["unit"]
    proj  = data["project"]
    ls    = data["lease_start"]            # date object
    ny    = data["num_years"]
    bm    = data["base_monthly"]           # monthly rent Y1
    esc   = data["escalation"]
    scm1  = data["sc_monthly_y1"]
    sc_esc= data.get("sc_escalation", esc)
    vr    = data.get("vat_rent", 0.01)
    vs    = data.get("vat_sc", 0.14)
    rs_yr = data.get("revenue_share_years", 0)   # how many RS years

    # ── Build year schedule ──────────────────────────────────────────────────
    years = []
    for y in range(ny):
        yr_start = ls + relativedelta(years=y)
        yr_end   = ls + relativedelta(years=y+1) - relativedelta(days=1)
        is_rs    = (y < rs_yr)

        rent_monthly = 0.0 if is_rs else bm * ((1 + esc) ** max(0, y - rs_yr))
        sc_monthly   = scm1 * ((1 + sc_esc) ** max(0, y - rs_yr))

        years.append({
            "y":           y + 1,
            "label":       f"السنة {y+1}",
            "period":      f"{yr_start.strftime('%d/%m/%Y')} – {yr_end.strftime('%d/%m/%Y')}",
            "is_rs":       is_rs,
            "rent_m":      rent_monthly,
            "rent_ann":    rent_monthly * 12,
            "sc_m":        sc_monthly,
            "sc_ann":      sc_monthly * 12,
            "vat_rent_m":  rent_monthly * vr,
            "vat_rent_ann":rent_monthly * vr * 12,
            "vat_sc_m":    sc_monthly * vs,
            "vat_sc_ann":  sc_monthly * vs * 12,
        })

    # Security deposit = 3 months of (rent + SC) of first rent-paying year
    first_rent_year = next((y for y in years if not y["is_rs"]), years[0])
    deposit = (first_rent_year["rent_m"] + first_rent_year["sc_m"]) * 3

    wb = Workbook()

    # ════════════════════════════════════════════════════════════════════════
    # SHEET 1 — Payment Schedule (Arabic)
    # ════════════════════════════════════════════════════════════════════════
    ws = wb.active
    ws.title = "جدول السداد"
    ws.sheet_view.rightToLeft = True
    ws.column_dimensions["A"].width = 12
    ws.column_dimensions["B"].width = 28
    ws.column_dimensions["C"].width = 18
    ws.column_dimensions["D"].width = 18
    ws.column_dimensions["E"].width = 18
    ws.column_dimensions["F"].width = 18
    ws.column_dimensions["G"].width = 18
    ws.column_dimensions["H"].width = 18

    # ── Header ───────────────────────────────────────────────────────────────
    ws.merge_cells("A1:H1")
    c = ws["A1"]
    c.value = "ملحق مالي — جدول السداد"
    c.font  = Font(name="Arial", bold=True, size=14, color=LIGHT)
    c.fill  = PatternFill("solid", fgColor=DARK)
    c.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 32

    ws.merge_cells("A2:H2")
    c = ws["A2"]
    c.value = f"{tn}  |  {unit}  |  {proj}"
    c.font  = Font(name="Arial", bold=True, size=11, color=DARK)
    c.fill  = PatternFill("solid", fgColor=YELLOW)
    c.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[2].height = 22

    ws.merge_cells("A3:H3")
    ws.row_dimensions[3].height = 8

    # ── Section helper ───────────────────────────────────────────────────────
    def section_header(row, title):
        ws.merge_cells(f"A{row}:H{row}")
        c = ws.cell(row, 1, title)
        c.font  = Font(name="Arial", bold=True, size=10, color=LIGHT)
        c.fill  = PatternFill("solid", fgColor=DARK)
        c.alignment = Alignment(horizontal="center", vertical="center",
                                wrap_text=True)
        ws.row_dimensions[row].height = 20

    def col_header(row, cols):
        for j, txt in enumerate(cols, 1):
            c = ws.cell(row, j, txt)
            c.font  = Font(name="Arial", bold=True, size=9, color=DARK)
            c.fill  = PatternFill("solid", fgColor=MID_GRAY)
            c.alignment = Alignment(horizontal="center", vertical="center",
                                    wrap_text=True)
            c.border = all_border()
        ws.row_dimensions[row].height = 28

    def money_row(row, year_dict, cols):
        """Write one data row. cols = list of values."""
        for j, val in enumerate(cols, 1):
            c = ws.cell(row, j)
            c.value  = val
            c.font   = Font(name="Arial", size=9)
            c.border = all_border()
            c.alignment = Alignment(horizontal="right" if isinstance(val, float) else "center",
                                    vertical="center")
            if isinstance(val, float):
                c.number_format = '#,##0.00'
            elif isinstance(val, str) and val.startswith("="):
                c.number_format = '#,##0.00'
        ws.row_dimensions[row].height = 18

    def total_row(row, cols):
        for j, val in enumerate(cols, 1):
            c = ws.cell(row, j)
            c.value = val
            c.font  = Font(name="Arial", bold=True, size=9, color=DARK)
            c.fill  = PatternFill("solid", fgColor=YELLOW)
            c.border = all_border()
            c.alignment = Alignment(horizontal="right" if isinstance(val, (float,int)) else "center",
                                    vertical="center")
            if isinstance(val, (float,int)) and not isinstance(val,bool):
                c.number_format = '#,##0.00'
        ws.row_dimensions[row].height = 20

    # ── Section 1: RENT ──────────────────────────────────────────────────────
    r = 4
    section_header(r, "أولاً: جدول الإيجار الأساسي")
    r += 1
    col_header(r, ["السنة","الفترة","الإيجار الشهري","الإيجار السنوي",
                    "ضريبة قيمة مضافة شهري","ضريبة قيمة مضافة سنوي",
                    "إجمالي شهري (شامل ض.ق.م)","إجمالي سنوي (شامل ض.ق.م)"])
    r += 1
    rent_start_row = r
    for y in years:
        label = f"{y['label']} (Revenue Share)" if y["is_rs"] else y["label"]
        total_m   = y["rent_m"] + y["vat_rent_m"]
        total_ann = y["rent_ann"] + y["vat_rent_ann"]
        money_row(r, y, [label, y["period"],
                         y["rent_m"], y["rent_ann"],
                         y["vat_rent_m"], y["vat_rent_ann"],
                         total_m, total_ann])
        r += 1
    # Totals
    tr = r
    tot_rent_ann    = sum(y["rent_ann"] for y in years)
    tot_vat_rent    = sum(y["vat_rent_ann"] for y in years)
    tot_rent_total  = tot_rent_ann + tot_vat_rent
    total_row(tr, ["الإجمالي","",
                   "",  tot_rent_ann,
                   "",  tot_vat_rent,
                   "",  tot_rent_total])
    r += 2

    # ── Section 2: SERVICE CHARGE ─────────────────────────────────────────────
    section_header(r, "ثانياً: جدول رسوم الخدمات")
    r += 1
    col_header(r, ["السنة","الفترة","رسوم الخدمات الشهرية","رسوم الخدمات السنوية",
                    "ضريبة قيمة مضافة شهري","ضريبة قيمة مضافة سنوي",
                    "إجمالي شهري (شامل ض.ق.م)","إجمالي سنوي (شامل ض.ق.م)"])
    r += 1
    for y in years:
        total_m   = y["sc_m"] + y["vat_sc_m"]
        total_ann = y["sc_ann"] + y["vat_sc_ann"]
        money_row(r, y, [y["label"], y["period"],
                         y["sc_m"], y["sc_ann"],
                         y["vat_sc_m"], y["vat_sc_ann"],
                         total_m, total_ann])
        r += 1
    tot_sc_ann   = sum(y["sc_ann"] for y in years)
    tot_vat_sc   = sum(y["vat_sc_ann"] for y in years)
    tot_sc_total = tot_sc_ann + tot_vat_sc
    total_row(r, ["الإجمالي","",
                  "", tot_sc_ann,
                  "", tot_vat_sc,
                  "", tot_sc_total])
    r += 2

    # ── Section 3: SECURITY DEPOSIT ──────────────────────────────────────────
    section_header(r, "ثالثاً: التأمين النقدي")
    r += 1
    dep_rent  = first_rent_year["rent_m"]  * 3
    dep_sc    = first_rent_year["sc_m"]    * 3
    rows_dep = [
        ("ثلاثة أشهر إيجار", dep_rent),
        ("ثلاثة أشهر رسوم خدمات", dep_sc),
        ("إجمالي التأمين النقدي", deposit),
    ]
    for label, val in rows_dep:
        ws.merge_cells(f"A{r}:F{r}")
        c = ws.cell(r, 1, label)
        c.font   = Font(name="Arial", size=9,
                        bold=(label.startswith("إجمالي")))
        c.fill   = PatternFill("solid", fgColor=(YELLOW if label.startswith("إجمالي") else LIGHT))
        c.border = all_border()
        c.alignment = Alignment(horizontal="right", vertical="center")
        ws.merge_cells(f"G{r}:H{r}")
        c2 = ws.cell(r, 7, val)
        c2.font   = Font(name="Arial", size=9,
                         bold=(label.startswith("إجمالي")))
        c2.fill   = PatternFill("solid", fgColor=(YELLOW if label.startswith("إجمالي") else LIGHT))
        c2.border = all_border()
        c2.alignment = Alignment(horizontal="right", vertical="center")
        c2.number_format = '#,##0.00'
        ws.row_dimensions[r].height = 18
        r += 1

    # ── Footer ───────────────────────────────────────────────────────────────
    r += 1
    ws.merge_cells(f"A{r}:H{r}")
    c = ws.cell(r, 1)
    c.value = "جميع المبالغ بالجنيه المصري (EGP)  |  الإيجار يخضع للتصاعد السنوي المتفق عليه"
    c.font  = Font(name="Arial", size=8, italic=True, color="666666")
    c.alignment = Alignment(horizontal="center", vertical="center")

    # ════════════════════════════════════════════════════════════════════════
    # SHEET 2 — Summary (English)
    # ════════════════════════════════════════════════════════════════════════
    ws2 = wb.create_sheet("Summary")
    ws2.column_dimensions["A"].width = 30
    ws2.column_dimensions["B"].width = 25
    ws2.column_dimensions["C"].width = 25

    ws2.merge_cells("A1:C1")
    c = ws2["A1"]
    c.value = "Financial Annex Summary"
    c.font  = Font(name="Arial", bold=True, size=13, color=LIGHT)
    c.fill  = PatternFill("solid", fgColor=DARK)
    c.alignment = Alignment(horizontal="center", vertical="center")
    ws2.row_dimensions[1].height = 30

    ws2.merge_cells("A2:C2")
    c = ws2["A2"]
    c.value = f"{tn}  |  {unit}  |  {proj}"
    c.font  = Font(name="Arial", bold=True, size=11, color=DARK)
    c.fill  = PatternFill("solid", fgColor=YELLOW)
    c.alignment = Alignment(horizontal="center", vertical="center")
    ws2.row_dimensions[2].height = 22

    info_rows = [
        ("Tenant", tn),
        ("Unit", unit),
        ("Project", proj),
        ("Lease Start", ls.strftime("%d %B %Y")),
        ("Lease Term", f"{ny} Years"),
        ("Escalation", f"{esc*100:.0f}% per annum"),
        ("VAT on Rent", f"{vr*100:.1f}%"),
        ("VAT on Service Charge", f"{vs*100:.0f}%"),
        ("Security Deposit", f"EGP {deposit:,.0f}"),
    ]

    r2 = 4
    for label, val in info_rows:
        ws2.merge_cells(f"A{r2}:A{r2}")
        c = ws2.cell(r2, 1, label)
        c.font   = Font(name="Arial", bold=True, size=9)
        c.fill   = PatternFill("solid", fgColor=MID_GRAY)
        c.border = all_border()
        c.alignment = Alignment(horizontal="left", vertical="center")
        ws2.merge_cells(f"B{r2}:C{r2}")
        c2 = ws2.cell(r2, 2, val)
        c2.font   = Font(name="Arial", size=9)
        c2.border = all_border()
        c2.alignment = Alignment(horizontal="left", vertical="center")
        ws2.row_dimensions[r2].height = 18
        r2 += 1

    r2 += 1
    # Year table
    headers = ["Year", "Period", "Monthly Rent", "Annual Rent",
               "Monthly SC", "Annual SC", "Total Monthly (incl VAT)", "Total Annual (incl VAT)"]
    for j, h in enumerate(headers, 1):
        ws2.column_dimensions[get_column_letter(j)].width = 18
        c = ws2.cell(r2, j, h)
        c.font  = Font(name="Arial", bold=True, size=9, color=DARK)
        c.fill  = PatternFill("solid", fgColor=MID_GRAY)
        c.border = all_border()
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws2.row_dimensions[r2].height = 28
    r2 += 1

    for y in years:
        label = f"Year {y['y']}" + (" (Rev. Share)" if y["is_rs"] else "")
        total_m   = y["rent_m"] + y["sc_m"] + y["vat_rent_m"] + y["vat_sc_m"]
        total_ann = total_m * 12
        row_data  = [label, y["period"], y["rent_m"], y["rent_ann"],
                     y["sc_m"], y["sc_ann"], total_m, total_ann]
        for j, val in enumerate(row_data, 1):
            c = ws2.cell(r2, j, val)
            c.font   = Font(name="Arial", size=9)
            c.border = all_border()
            c.alignment = Alignment(horizontal="right" if isinstance(val,float) else "center",
                                    vertical="center")
            if isinstance(val, float):
                c.number_format = '#,##0.00'
        ws2.row_dimensions[r2].height = 18
        r2 += 1

    # Totals row summary
    tot_all_ann = sum(y["rent_ann"]+y["sc_ann"]+y["vat_rent_ann"]+y["vat_sc_ann"] for y in years)
    for j, val in enumerate(["TOTAL","","","",
                              "", "",
                              "", tot_all_ann], 1):
        c = ws2.cell(r2, j, val)
        c.font  = Font(name="Arial", bold=True, size=9)
        c.fill  = PatternFill("solid", fgColor=YELLOW)
        c.border = all_border()
        c.alignment = Alignment(horizontal="right" if isinstance(val,float) else "center",
                                vertical="center")
        if isinstance(val, float):
            c.number_format = '#,##0.00'
    ws2.row_dimensions[r2].height = 20

    wb.save(output_path)
    print(f"✅ Saved: {output_path}")
    return years, deposit

# ── Test with a sample deal ───────────────────────────────────────────────────
if __name__ == "__main__":
    test_data = {
        "tenant_name": "Cilantro",
        "unit": "F01",
        "project": "Giza Zoo Commercial Destination",
        "lease_start": date(2025, 11, 1),
        "num_years": 5,
        "base_monthly": 150_000,
        "escalation": 0.10,
        "sc_monthly_y1": 30_000,
        "sc_escalation": 0.10,
        "vat_rent": 0.01,
        "vat_sc": 0.14,
        "revenue_share_years": 0,
    }

    years, deposit = build_annex(test_data, "/home/claude/test_annex.xlsx")

    print("\n── Rent Schedule ──")
    for y in years:
        print(f"  Y{y['y']} | {y['period']} | Rent/mo: {y['rent_m']:>12,.0f} | SC/mo: {y['sc_m']:>10,.0f}")
    print(f"\n  Security Deposit: EGP {deposit:,.0f}")
