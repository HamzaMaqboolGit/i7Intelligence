import countries from "i18n-iso-countries";
export const countryCodes = Object.keys(countries.getAlpha2Codes());
const names = new Intl.DisplayNames(["en"], { type: "region" });
export const countryOptions = countryCodes
  .map((value) => ({ value, label: names.of(value) || value }))
  .sort((a, b) => a.label.localeCompare(b.label));
