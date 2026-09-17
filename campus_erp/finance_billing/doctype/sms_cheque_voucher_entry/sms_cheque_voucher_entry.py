import frappe
from frappe.model.document import Document

from campus_erp.finance_billing.doctype.sms_campus_gl_entry.sms_campus_gl_entry import (
    post_gl_entries,
    reverse_gl_entries,
)


class SMSChequeVoucherEntry(Document):
    def validate(self):
        if not self.gl_entries:
            frappe.throw("At least one GL Entry is required.")

        total_debit = 0
        total_credit = 0

        for row in self.gl_entries:
            if not row.account:
                frappe.throw("Every GL Entry row must have an Account.")

            debit = row.debit or 0
            credit = row.credit or 0

            if debit and credit:
                frappe.throw(
                    f"GL Entry row {row.idx} cannot have both Debit and Credit."
                )

            if not debit and not credit:
                frappe.throw(
                    f"GL Entry row {row.idx} must have either Debit or Credit."
                )

            if debit < 0 or credit < 0:
                frappe.throw(
                    f"GL Entry row {row.idx} cannot contain negative amounts."
                )

            total_debit += debit
            total_credit += credit

        if round(total_debit, 2) != round(total_credit, 2):
            frappe.throw(
                f"Total Debit ({total_debit}) must equal Total Credit ({total_credit})."
            )

        cheque_amount = self.amount or 0

        if round(total_debit, 2) != round(cheque_amount, 2):
            frappe.throw(
                f"GL total ({total_debit}) must equal cheque amount ({cheque_amount})."
            )

        self.total_debit = total_debit

    def on_submit(self):
        existing = frappe.db.exists(
            "SMS Campus GL Entry",
            {
                "voucher_type": self.doctype,
                "voucher_no": self.name,
            },
        )

        if existing:
            frappe.throw(
                f"GL entries already exist for {self.doctype} {self.name}."
            )

        rows = []

        for row in self.gl_entries:
            account_names = [
                r.account for r in self.gl_entries if r.name != row.name
            ]

            rows.append({
                "account": row.account,
                "debit": row.debit or 0,
                "credit": row.credit or 0,
                "party_type": row.party_type,
                "party": row.party,
                "against_account": (
                    account_names[0] if len(account_names) == 1 else None
                ),
                "remarks": self.notes,
            })

        post_gl_entries(
            voucher_type=self.doctype,
            voucher_no=self.name,
            posting_date=self.date,
            rows=rows,
        )

    def on_cancel(self):
        reverse_gl_entries(
            voucher_type=self.doctype,
            voucher_no=self.name,
        )
