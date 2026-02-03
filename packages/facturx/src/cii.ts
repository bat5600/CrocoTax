import { CanonicalInvoice, CanonicalParty } from "@croco/core";
import { computeInvoiceTotals } from "./totals";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return value;
  }
  return `${match[1]}${match[2]}${match[3]}`;
}

function renderPostalTradeAddress(party: CanonicalParty): string {
  const parts: string[] = [];
  if (party.addressLine1) {
    parts.push(`<ram:LineOne>${escapeXml(party.addressLine1)}</ram:LineOne>`);
  }
  if (party.addressLine2) {
    parts.push(`<ram:LineTwo>${escapeXml(party.addressLine2)}</ram:LineTwo>`);
  }
  if (party.postalCode) {
    parts.push(`<ram:PostcodeCode>${escapeXml(party.postalCode)}</ram:PostcodeCode>`);
  }
  if (party.city) {
    parts.push(`<ram:CityName>${escapeXml(party.city)}</ram:CityName>`);
  }
  if (party.state) {
    parts.push(`<ram:CountrySubDivisionName>${escapeXml(party.state)}</ram:CountrySubDivisionName>`);
  }
  parts.push(`<ram:CountryID>${escapeXml(party.country)}</ram:CountryID>`);
  return `<ram:PostalTradeAddress>${parts.join("")}</ram:PostalTradeAddress>`;
}

function renderTaxRegistration(party: CanonicalParty): string {
  if (party.vatId) {
    return `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escapeXml(party.vatId)}</ram:ID></ram:SpecifiedTaxRegistration>`;
  }
  if (party.taxId) {
    return `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${escapeXml(party.taxId)}</ram:ID></ram:SpecifiedTaxRegistration>`;
  }
  return "";
}

function renderTradeContact(party: CanonicalParty): string {
  if (!party.email && !party.phone) {
    return "";
  }
  const parts: string[] = [];
  if (party.email) {
    parts.push(
      `<ram:EmailURIUniversalCommunication><ram:URIID>${escapeXml(party.email)}</ram:URIID></ram:EmailURIUniversalCommunication>`
    );
  }
  if (party.phone) {
    parts.push(
      `<ram:TelephoneUniversalCommunication><ram:CompleteNumber>${escapeXml(party.phone)}</ram:CompleteNumber></ram:TelephoneUniversalCommunication>`
    );
  }
  return `<ram:DefinedTradeContact>${parts.join("")}</ram:DefinedTradeContact>`;
}

function buildHeaderTaxes(invoice: CanonicalInvoice): string {
  const groups = new Map<number, { basis: number; tax: number }>();
  for (const line of invoice.lines) {
    const basis = line.quantity * line.unitPrice;
    const tax = basis * line.taxRate;
    const current = groups.get(line.taxRate) ?? { basis: 0, tax: 0 };
    current.basis += basis;
    current.tax += tax;
    groups.set(line.taxRate, current);
  }

  return Array.from(groups.entries())
    .map(([rate, totals]) => {
      const categoryCode = rate === 0 ? "Z" : "S";
      return `
      <ram:ApplicableTradeTax>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:CategoryCode>${categoryCode}</ram:CategoryCode>
        <ram:RateApplicablePercent>${(rate * 100).toFixed(2)}</ram:RateApplicablePercent>
        <ram:BasisAmount>${totals.basis.toFixed(2)}</ram:BasisAmount>
        <ram:CalculatedAmount>${totals.tax.toFixed(2)}</ram:CalculatedAmount>
      </ram:ApplicableTradeTax>`;
    })
    .join("");
}

function buildPaymentTerms(invoice: CanonicalInvoice): string {
  if (!invoice.paymentTerms && !invoice.dueDate) {
    return "";
  }
  const parts: string[] = [];
  if (invoice.paymentTerms) {
    parts.push(`<ram:Description>${escapeXml(invoice.paymentTerms)}</ram:Description>`);
  }
  if (invoice.dueDate) {
    parts.push(
      `<ram:DueDateDateTime><udt:DateTimeString format="102">${formatDate(
        invoice.dueDate
      )}</udt:DateTimeString></ram:DueDateDateTime>`
    );
  }
  return `<ram:SpecifiedTradePaymentTerms>${parts.join("")}</ram:SpecifiedTradePaymentTerms>`;
}

export function buildCiiXml(invoice: CanonicalInvoice): string {
  const totals = computeInvoiceTotals(invoice);
  const lines = invoice.lines
    .map((line, index) => {
      const lineTotal = line.quantity * line.unitPrice;
      const categoryCode = line.taxRate === 0 ? "Z" : "S";
      return `
      <ram:IncludedSupplyChainTradeLineItem>
        <ram:AssociatedDocumentLineDocument>
          <ram:LineID>${index + 1}</ram:LineID>
        </ram:AssociatedDocumentLineDocument>
        <ram:SpecifiedTradeProduct>
          <ram:Name>${escapeXml(line.description)}</ram:Name>
        </ram:SpecifiedTradeProduct>
        <ram:SpecifiedLineTradeAgreement>
          <ram:NetPriceProductTradePrice>
            <ram:ChargeAmount>${line.unitPrice.toFixed(2)}</ram:ChargeAmount>
          </ram:NetPriceProductTradePrice>
        </ram:SpecifiedLineTradeAgreement>
        <ram:SpecifiedLineTradeDelivery>
          <ram:BilledQuantity unitCode="C62">${line.quantity}</ram:BilledQuantity>
        </ram:SpecifiedLineTradeDelivery>
        <ram:SpecifiedLineTradeSettlement>
          <ram:ApplicableTradeTax>
            <ram:TypeCode>VAT</ram:TypeCode>
            <ram:CategoryCode>${categoryCode}</ram:CategoryCode>
            <ram:RateApplicablePercent>${(line.taxRate * 100).toFixed(2)}</ram:RateApplicablePercent>
          </ram:ApplicableTradeTax>
          <ram:SpecifiedTradeSettlementLineMonetarySummation>
            <ram:LineTotalAmount>${lineTotal.toFixed(2)}</ram:LineTotalAmount>
          </ram:SpecifiedTradeSettlementLineMonetarySummation>
        </ram:SpecifiedLineTradeSettlement>
      </ram:IncludedSupplyChainTradeLineItem>`;
    })
    .join("");

  const paymentTerms = buildPaymentTerms(invoice);
  const headerTaxes = buildHeaderTaxes(invoice);
  const allowanceTotal =
    totals.discountTotal > 0
      ? `<ram:AllowanceTotalAmount>${totals.discountTotal.toFixed(2)}</ram:AllowanceTotalAmount>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(invoice.invoiceNumber)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatDate(invoice.issueDate)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    ${lines}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(invoice.seller.name)}</ram:Name>
        ${renderPostalTradeAddress(invoice.seller)}
        ${renderTaxRegistration(invoice.seller)}
        ${renderTradeContact(invoice.seller)}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(invoice.buyer.name)}</ram:Name>
        ${renderPostalTradeAddress(invoice.buyer)}
        ${renderTaxRegistration(invoice.buyer)}
        ${renderTradeContact(invoice.buyer)}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${invoice.currency}</ram:InvoiceCurrencyCode>
      ${headerTaxes}
      ${paymentTerms}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${totals.netTotal.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${totals.taxBasisTotal.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount>${totals.taxTotal.toFixed(2)}</ram:TaxTotalAmount>
        ${allowanceTotal}
        <ram:GrandTotalAmount>${totals.grandTotal.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${totals.dueTotal.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}
