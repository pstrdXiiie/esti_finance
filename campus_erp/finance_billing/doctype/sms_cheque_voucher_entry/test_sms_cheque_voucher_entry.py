import frappe
from frappe.tests.utils import FrappeTestCase


class TestSMSChequeVoucherEntry(FrappeTestCase):
    def make_voucher(self, amount=100):
        return frappe.get_doc({
            "doctype": "SMS Cheque Voucher Entry",
            "payee": "Automated Test Payee",
            "date": "2026-09-11",
            "check_number": frappe.generate_hash(length=10),
            "check_date": "2026-09-11",
            "amount": amount,
            "notes": "Automated cheque voucher test",
            "gl_entries": [
                {
                    "account": "1010 - Office Supplies Expense - ESTI",
                    "debit": amount,
                    "credit": 0,
                },
                {
                    "account": "1000 - Cash in Bank (Operating) - ESTI",
                    "debit": 0,
                    "credit": amount,
                },
            ],
        })

    def test_balanced_voucher_validation(self):
        doc = self.make_voucher(100)

        doc.validate()

        self.assertEqual(doc.total_debit, 100)

    def test_unbalanced_voucher_rejected(self):
        doc = self.make_voucher(100)
        doc.gl_entries[1].credit = 90

        with self.assertRaises(frappe.ValidationError):
            doc.validate()

    def test_gl_total_must_equal_cheque_amount(self):
        doc = self.make_voucher(150)

        with self.assertRaises(frappe.ValidationError):
            doc.validate()

    def test_row_cannot_have_both_debit_and_credit(self):
        doc = self.make_voucher(100)
        doc.gl_entries[0].credit = 10

        with self.assertRaises(frappe.ValidationError):
            doc.validate()

    def test_row_requires_debit_or_credit(self):
        doc = self.make_voucher(100)
        doc.gl_entries[0].debit = 0

        with self.assertRaises(frappe.ValidationError):
            doc.validate()

    def test_negative_amount_rejected(self):
        doc = self.make_voucher(100)
        doc.gl_entries[0].debit = -100

        with self.assertRaises(frappe.ValidationError):
            doc.validate()

    def test_submit_creates_gl_entries(self):
        doc = self.make_voucher(100)
        doc.insert()
        doc.submit()

        self.assertEqual(doc.docstatus, 1)

        entries = frappe.get_all(
            "SMS Campus GL Entry",
            filters={
                "voucher_type": doc.doctype,
                "voucher_no": doc.name,
            },
            fields=[
                "name",
                "account",
                "debit",
                "credit",
                "against_account",
                "is_cancelled",
            ],
            order_by="creation asc",
        )

        self.assertEqual(len(entries), 2)
        self.assertEqual(entries[0].debit, 100)
        self.assertEqual(entries[0].credit, 0)
        self.assertEqual(entries[1].debit, 0)
        self.assertEqual(entries[1].credit, 100)
        self.assertEqual(entries[0].against_account, entries[1].account)
        self.assertEqual(entries[1].against_account, entries[0].account)
        self.assertTrue(all(entry.is_cancelled == 0 for entry in entries))

    def test_cancel_reverses_gl_entries(self):
        doc = self.make_voucher(100)
        doc.insert()
        doc.submit()
        doc.cancel()

        self.assertEqual(doc.docstatus, 2)

        entries = frappe.get_all(
            "SMS Campus GL Entry",
            filters={
                "voucher_type": doc.doctype,
                "voucher_no": doc.name,
            },
            fields=[
                "name",
                "account",
                "debit",
                "credit",
                "is_cancelled",
            ],
            order_by="creation asc",
        )

        self.assertEqual(len(entries), 2)
        self.assertTrue(all(entry.is_cancelled == 1 for entry in entries))
