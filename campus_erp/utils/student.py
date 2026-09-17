import frappe
from frappe.utils import getdate, nowdate


def _next_control_number(ref_date=None) -> str:
    ref_date = getdate(ref_date or nowdate())
    yy = str(ref_date.year)[-2:]

    # find the highest existing sequence number for this year
    existing = frappe.db.sql(
        """
        SELECT stdnt_cno FROM `tabStudent`
        WHERE stdnt_cno LIKE %s
        ORDER BY stdnt_cno DESC LIMIT 1
        """,
        (f"{yy}-%",),
    )

    if existing and existing[0][0]:
        last_seq = int(existing[0][0].split("-")[1])
    else:
        last_seq = 110664  # matches legacy numbering base seen in old records

    return f"{yy}-{last_seq + 1:06d}"


def set_student_control_number(doc, method):
    """Auto-generate stdnt_cno in the legacy format YY-NNNNNN
    (e.g. 26-110665), sequential per year, on Student insert."""
    if doc.get("stdnt_cno"):
        return  # don't overwrite if somehow already set

    doc.stdnt_cno = _next_control_number(doc.joining_date)


@frappe.whitelist()
def preview_student_control_number():
    """Read-only preview of the Student Control No. the next enrollee would
    be assigned, for display on the Add Student wizard. Not reserved —
    computed the same way as set_student_control_number, so it's best-
    effort and can differ if another enrollee is created in between; the
    number actually assigned on insert is the source of truth.

    There is no transferee/regular distinction in this numbering scheme
    (unlike some earlier drafts of this feature) — every Student shares one
    sequence per year.
    """
    return _next_control_number()
