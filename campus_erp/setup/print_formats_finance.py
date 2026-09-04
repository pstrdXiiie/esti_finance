# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""
Finance module print formats (Student Billing / "PERMIT" screen — see
IMPLEMENTATION-MAPPING.md's Student Billing section). Companion to
custom_fields_finance.py: idempotent, safe to call every after_migrate.

Only one format so far: the per-student Statement of Accounts printed from
the Student Billing screen's Generate button, sourced from SMS Permit
directly (total_fee/payment/due_payment/permit_no/due_date/term already
live there — no join needed). Matches the legacy Crystal Reports layout
captured in the reference screenshots: Total Tuition / Total Payment /
Total Balance, a "Payable for [term]" box, a due-date reminder, and
Prepared By / Certified Correct signature lines.
"""

import frappe

STATEMENT_OF_ACCOUNTS_HTML = """
<div style="font-family: Arial, sans-serif; padding: 20px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h2 style="margin-bottom: 4px;">Statement of Accounts</h2>
    <div style="color: #555;">Permit No: {{ doc.permit_no or doc.name }}</div>
  </div>

  <table style="width: 100%; margin-bottom: 16px;">
    <tr>
      <td style="width: 50%;"><strong>Student:</strong>
        {{ frappe.db.get_value("Student", doc.student, "student_name") or doc.student }}
        ({{ doc.student }})</td>
      <td style="width: 50%;"><strong>School Year:</strong> {{ doc.school_year }}</td>
    </tr>
    <tr>
      <td><strong>Course:</strong> {{ doc.course }}</td>
      <td><strong>Year Level:</strong> {{ doc.year_level }}</td>
    </tr>
    <tr>
      <td><strong>Term:</strong> {{ doc.term }}</td>
      <td><strong>Status:</strong> {{ doc.status }}</td>
    </tr>
  </table>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
    <thead>
      <tr style="background: #2e7d32; color: #fff;">
        <th style="border: 1px solid #ccc; padding: 6px; text-align: left;">Total Tuition</th>
        <th style="border: 1px solid #ccc; padding: 6px; text-align: left;">Total Payment</th>
        <th style="border: 1px solid #ccc; padding: 6px; text-align: left;">Total Balance</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border: 1px solid #ccc; padding: 6px;">{{ "%.2f"|format(doc.total_fee or 0) }}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">{{ "%.2f"|format(doc.payment or 0) }}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">{{ "%.2f"|format(doc.due_payment or 0) }}</td>
      </tr>
    </tbody>
  </table>

  <div style="border: 2px solid #2e7d32; padding: 10px 14px; margin-bottom: 16px; display: inline-block;">
    <strong>Payable for {{ doc.term or "this term" }}:</strong>
    &nbsp; PHP {{ "%.2f"|format(doc.due_payment or 0) }}
  </div>

  {% if doc.due_date %}
  <p style="color: #b71c1c;">
    Please settle the above balance on or before <strong>{{ doc.due_date }}</strong> to avoid holds on enrollment/records.
  </p>
  {% endif %}

  <table style="width: 100%; margin-top: 60px;">
    <tr>
      <td style="width: 50%; text-align: center;">
        <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto; padding-top: 4px;">Prepared By</div>
      </td>
      <td style="width: 50%; text-align: center;">
        <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto; padding-top: 4px;">Certified Correct</div>
      </td>
    </tr>
  </table>
</div>
"""


def sync_finance_print_formats():
        """Idempotent — safe to call from after_migrate every time, matching
        sync_finance_custom_fields()'s pattern. Creates the Statement of
        Accounts print format for SMS Permit if it doesn't already exist;
        updates the HTML in place on doctypes that already have it, so a
        template edit here takes effect on the next migrate rather than
        being silently skipped."""
        name = "SMS Permit Statement of Accounts"
        if frappe.db.exists("Print Format", name):
                frappe.db.set_value("Print Format", name, "html", STATEMENT_OF_ACCOUNTS_HTML)
        else:
                frappe.get_doc({
                        "doctype": "Print Format",
                        "name": name,
                        "doc_type": "SMS Permit",
                        "module": "Finance Billing",
                        "print_format_type": "Jinja",
                        "standard": "No",
                        "custom_format": 1,
                        "disabled": 0,
                        "html": STATEMENT_OF_ACCOUNTS_HTML,
                }).insert(ignore_permissions=True)
        frappe.clear_cache()
