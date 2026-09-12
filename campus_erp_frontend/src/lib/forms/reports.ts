import { ReportSpec } from "./types";

export const trialBalanceSpec: ReportSpec = {
  title: "Trial Balance",
  method: "campus_erp.api.finance.get_trial_balance",
  filters: [
    {
      fieldname: "as_of_date",
      label: "As of",
      fieldtype: "Date",
      required: true,
    },
  ],
  columns: [
    { fieldname: "account_number", label: "Acct No.", fieldtype: "Data" },
    { fieldname: "account_name", label: "Account Titles", fieldtype: "Data" },
    { fieldname: "beginning_debit", label: "Beg. Debit", fieldtype: "Currency" },
    { fieldname: "beginning_credit", label: "Beg. Credit", fieldtype: "Currency" },
    { fieldname: "transactions_debit", label: "Trans. Debit", fieldtype: "Currency" },
    { fieldname: "transactions_credit", label: "Trans. Credit", fieldtype: "Currency" },
    { fieldname: "ending_debit", label: "End. Debit", fieldtype: "Currency" },
    { fieldname: "ending_credit", label: "End. Credit", fieldtype: "Currency" },
  ],
};
