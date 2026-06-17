from openpyxl import Workbook
from openpyxl.styles import (Font, PatternFill, Alignment, Border, Side,
                              GradientFill)
from openpyxl.utils import get_column_letter
from dateutil.relativedelta import relativedelta
from datetime import date
import math

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
    c.alignment = Alignment(horizontal=align, vertical="center", wrap_text=wrap)
    if border:
        c.border = all_border()
    if num_fmt:
        c.number_format = num_fmt
    return c

def build_annex(data: dict, output_path: str):
    tn    = data["tenant_name"]
    unit  = data["unit"]
    proj  = data["project"]
    ls    = data["lease_start"]
    ny    = data["num_years"]
    bm    = data["base_monthly"]
    esc   = data["escalation"]
    scm1  = data["sc_monthly_y1"]
    sc_esc= data.get("sc_escalation", esc)
    vr    = data.get("vat_rent", 0.01)
    vs    = data.get("vat_sc", 0.14)
    rs_yr = data.get("revenue_share_years", 0)
    mkt_rate = data.get("marketing_rate", 0.0)

    years = []
    for y in range(ny):
        yr_start = ls + relativedelta(years=y)
        yr_end   = ls + relativedelta(years=y+1) - relativedelta(days=1)
        is_rs    = (y < rs_yr)
        rent_monthly = 0.0 if is_rs else bm * ((1 + esc) ** max(0, y - rs_yr))
        sc_monthly   = scm1 * ((1 + sc_esc) ** max(0, y - rs_yr))
        mkt_annual  = round(rent_monthly * 12 * mkt_rate, 2)
        years.append({
            "y":           y + 1,
            "label":       f"السنة {y+1}",
            "period":      f"{yr_start.strftime('%d/%m/%Y')} – {yr_end.strftime('%d/%m/%Y')}",
            "is_rs":       is_rs,
            "rent_m":      rent_monthly,
            "rent_ann":    round(rent_monthly * 12, 2),
            "sc_m":        sc_monthly,
            "sc_ann":      round(sc_monthly * 12, 2),
            "vat_rent_m":  round(rent_monthly * vr, 2),
            "vat_rent_ann":round(rent_monthly * vr * 12, 2),
            "vat_sc_m":    round(sc_monthly * vs, 2),
            "vat_sc_ann":  round(sc_monthly * vs * 12, 2),
            "mkt_ann":     mkt_annual,
            "vat_mkt_ann": round(mkt_annual * vs, 2),
        })

    first_rent_year = next((y for y in years if not y["is_rs"]), years[0])
    deposit = (first_rent_year["rent_m"] + first_rent_year["sc_m"]) * 3

    wb = Workbook()
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

    def section_header(row, title):
        ws.merge_cells(f"A{row}:H{row}")
        c = ws.cell(row, 1, title)
        c.font  = Font(name="Arial", bold=True, size=10, color=LIGHT)
        c.fill  = PatternFill("solid", fgColor=DARK)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws.row_dimensions[row].height = 20

    def col_header(row, cols):
        for j, txt in enumerate(cols, 1):
            c = ws.cell(row, j, txt)
            c.font  = Font(name="Arial", bold=True, size=9, color=DARK)
            c.fill  = PatternFill("solid", fgColor=MID_GRAY)
            c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            c.border = all_border()
        ws.row_dimensions[row].height = 28

    _data_row_count = [0]
    def money_row(row, year_dict, cols):
        _data_row_count[0] += 1
        bg = LIGHT if _data_row_count[0] % 2 == 1 else MID_GRAY
        for j, val in enumerate(cols, 1):
            c = ws.cell(row, j)
            c.value  = val
            c.font   = Font(name="Arial", size=9, color="000000")
            c.fill   = PatternFill("solid", fgColor=bg)
            c.border = all_border()
            c.alignment = Alignment(horizontal="right" if isinstance(val, float) else "center", vertical="center")
            if isinstance(val, (float, int)) and not isinstance(val, bool):
                c.number_format = '#,##0.00'
        ws.row_dimensions[row].height = 18

    def total_row(row, cols):
        for j, val in enumerate(cols, 1):
            c = ws.cell(row, j)
            c.value = val
            c.font  = Font(name="Arial", bold=True, size=9, color=DARK)
            c.fill  = PatternFill("solid", fgColor=YELLOW)
            c.border = all_border()
            c.alignment = Alignment(horizontal="right" if isinstance(val, (float,int)) else "center", vertical="center")
            if isinstance(val, (float,int)) and not isinstance(val,bool):
                c.number_format = '#,##0.00'
        ws.row_dimensions[row].height = 20

    r = 4
    section_header(r, f"أولاً: جدول الإيجار الأساسي  —  تصاعد سنوي {esc*100:g}%")
    r += 1
    col_header(r, ["السنة","الفترة","الإيجار الشهري","الإيجار السنوي",
                    "ضريبة قيمة مضافة شهري","ضريبة قيمة مضافة سنوي",
                    "إجمالي شهري (شامل ض.ق.م)","إجمالي سنوي (شامل ض.ق.م)"])
    r += 1
    for y in years:
        label = f"{y['label']} (Revenue Share)" if y["is_rs"] else y["label"]
        total_m   = round(y["rent_m"] + y["vat_rent_m"], 2)
        total_ann = round(y["rent_ann"] + y["vat_rent_ann"], 2)
        money_row(r, y, [label, y["period"],
                         y["rent_m"], y["rent_ann"],
                         y["vat_rent_m"], y["vat_rent_ann"],
                         total_m, total_ann])
        r += 1
    tr = r
    tot_rent_ann    = sum(y["rent_ann"] for y in years)
    tot_vat_rent    = sum(y["vat_rent_ann"] for y in years)
    tot_rent_total  = tot_rent_ann + tot_vat_rent
    total_row(tr, ["الإجمالي","", "", tot_rent_ann, "", tot_vat_rent, "", tot_rent_total])
    r += 2

    section_header(r, "ثانياً: جدول رسوم الخدمات")
    r += 1
    col_header(r, ["السنة","الفترة","رسوم الخدمات الشهرية","رسوم الخدمات السنوية",
                    "ضريبة قيمة مضافة شهري","ضريبة قيمة مضافة سنوي",
                    "إجمالي شهري (شامل ض.ق.م)","إجمالي سنوي (شامل ض.ق.م)"])
    r += 1
    for y in years:
        total_m   = round(y["sc_m"] + y["vat_sc_m"], 2)
        total_ann = round(y["sc_ann"] + y["vat_sc_ann"], 2)
        money_row(r, y, [y["label"], y["period"],
                         y["sc_m"], y["sc_ann"],
                         y["vat_sc_m"], y["vat_sc_ann"],
                         total_m, total_ann])
        r += 1
    tot_sc_ann   = sum(y["sc_ann"] for y in years)
    tot_vat_sc   = sum(y["vat_sc_ann"] for y in years)
    tot_sc_total = tot_sc_ann + tot_vat_sc
    total_row(r, ["الإجمالي","", "", tot_sc_ann, "", tot_vat_sc, "", tot_sc_total])
    r += 2

    if mkt_rate > 0:
        section_header(r, "ثالثاً: رسوم التسويق")
        r += 1
        col_header(r, ["السنة","الفترة","الإيجار السنوي الأساسي","نسبة رسوم التسويق",
                        "رسوم التسويق السنوية","ضريبة قيمة مضافة (14%)",
                        "إجمالي رسوم التسويق (شامل ض.ق.م)","موعد السداد"])
        r += 1
        for y in years:
            total_ann = round(y["mkt_ann"] + y["vat_mkt_ann"], 2)
            yr_label  = f"أول شهر السنة {y['y']}"
            money_row(r, y, [y["label"], y["period"],
                             round(y["rent_ann"],2), f"{mkt_rate*100:.0f}%",
                             y["mkt_ann"], y["vat_mkt_ann"],
                             total_ann, yr_label])
            r += 1
        tot_mkt_ann   = sum(y["mkt_ann"] for y in years)
        tot_vat_mkt   = sum(y["vat_mkt_ann"] for y in years)
        tot_mkt_total = tot_mkt_ann + tot_vat_mkt
        total_row(r, ["الإجمالي","", "", "", tot_mkt_ann, tot_vat_mkt, tot_mkt_total, ""])
        r += 2
        deposit_label = "رابعاً: التأمين النقدي"
    else:
        deposit_label = "ثالثاً: التأمين النقدي"

    section_header(r, deposit_label)
    r += 1
    dep_rent  = first_rent_year["rent_m"] * 3
    dep_sc    = first_rent_year["sc_m"]   * 3
    rows_dep = [
        ("ثلاثة أشهر إيجار", dep_rent),
        ("ثلاثة أشهر رسوم خدمات", dep_sc),
        ("إجمالي التأمين النقدي", deposit),
    ]
    for label, val in rows_dep:
        ws.merge_cells(f"A{r}:F{r}")
        c = ws.cell(r, 1, label)
        c.font   = Font(name="Arial", size=9, bold=(label.startswith("إجمالي")))
        c.fill   = PatternFill("solid", fgColor=(YELLOW if label.startswith("إجمالي") else LIGHT))
        c.border = all_border()
        c.alignment = Alignment(horizontal="right", vertical="center")
        ws.merge_cells(f"G{r}:H{r}")
        c2 = ws.cell(r, 7, val)
        c2.font   = Font(name="Arial", size=9, bold=(label.startswith("إجمالي")))
        c2.fill   = PatternFill("solid", fgColor=(YELLOW if label.startswith("إجمالي") else LIGHT))
        c2.border = all_border()
        c2.alignment = Alignment(horizontal="right", vertical="center")
        c2.number_format = '#,##0.00'
        ws.row_dimensions[r].height = 18
        r += 1

    r += 1
    ws.merge_cells(f"A{r}:H{r}")
    c = ws.cell(r, 1)
    c.value = f"جميع المبالغ بالجنيه المصري (EGP)  |  الإيجار يخضع للتصاعد السنوي بنسبة {esc*100:g}% سنوياً"
    c.font  = Font(name="Arial", size=8, italic=True, color="666666")
    c.alignment = Alignment(horizontal="center", vertical="center")

    # Sheet 2 — Summary
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
        ("Escalation", f"{esc*100:g}% per annum"),
        ("VAT on Rent", f"{vr*100:.1f}%"),
        ("VAT on Service Charge", f"{vs*100:.0f}%"),
        ("Security Deposit", f"EGP {deposit:,.0f}"),
    ] + ([("Marketing Rate", f"{mkt_rate*100:.1f}% of annual rent")] if mkt_rate > 0 else [])

    r2 = 4
    for label, val in info_rows:
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
    has_mkt = mkt_rate > 0
    headers = ["Year", "Period", "Monthly Rent", "Annual Rent", "Monthly SC", "Annual SC"] + \
              (["Monthly Marketing", "Annual Marketing"] if has_mkt else []) + \
              ["Total Monthly (incl VAT)", "Total Annual (incl VAT)"]
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
        total_ann = round(y["rent_ann"] + y["sc_ann"] + y["vat_rent_ann"] + y["vat_sc_ann"] +
                          (y["mkt_ann"] + y["vat_mkt_ann"] if has_mkt else 0), 2)
        total_m   = round(total_ann / 12, 2)
        mkt_cols  = [y["mkt_ann"], y["vat_mkt_ann"], round(y["mkt_ann"]+y["vat_mkt_ann"],2)] if has_mkt else []
        row_data  = [label, y["period"], y["rent_m"], y["rent_ann"],
                     y["sc_m"], y["sc_ann"]] + mkt_cols + [total_m, total_ann]
        for j, val in enumerate(row_data, 1):
            c = ws2.cell(r2, j, val)
            c.font   = Font(name="Arial", size=9)
            c.border = all_border()
            c.alignment = Alignment(horizontal="right" if isinstance(val,float) else "center", vertical="center")
            if isinstance(val, float):
                c.number_format = '#,##0.00'
        ws2.row_dimensions[r2].height = 18
        r2 += 1

    tot_all_ann = sum(y["rent_ann"]+y["sc_ann"]+y["vat_rent_ann"]+y["vat_sc_ann"] for y in years)
    for j, val in enumerate(["TOTAL","","","","","","",tot_all_ann], 1):
        c = ws2.cell(r2, j, val)
        c.font  = Font(name="Arial", bold=True, size=9)
        c.fill  = PatternFill("solid", fgColor=YELLOW)
        c.border = all_border()
        c.alignment = Alignment(horizontal="right" if isinstance(val,float) else "center", vertical="center")
        if isinstance(val, float):
            c.number_format = '#,##0.00'
    ws2.row_dimensions[r2].height = 20

    wb.save(output_path)
    return years, deposit

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
        print(f"  Y{y['y']} | Rent/mo: {y['rent_m']:>12,.0f}")
    print(f"  Security Deposit: EGP {deposit:,.0f}")
