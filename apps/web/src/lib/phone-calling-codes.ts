import { all as allCountries } from "country-codes-list"

export interface PhoneCallingCodeOption {
  iso2: string
  name: string
  callingCode: string
}

export function getCallingCodeOptions(): PhoneCallingCodeOption[] {
  const uniqueByIsoAndCode = new Map<string, PhoneCallingCodeOption>()

  for (const country of allCountries()) {
    if (!country.countryCallingCode) continue

    const option = {
      iso2: country.countryCode,
      name: country.countryNameEn,
      callingCode: `+${country.countryCallingCode}`,
    }
    const key = `${option.iso2}-${option.callingCode}`
    if (!uniqueByIsoAndCode.has(key)) uniqueByIsoAndCode.set(key, option)
  }

  return Array.from(uniqueByIsoAndCode.values()).sort((a, b) => {
    const priority = callingCodePriority(a.iso2) - callingCodePriority(b.iso2)
    return priority || a.name.localeCompare(b.name)
  })
}

function callingCodePriority(iso2: string) {
  return iso2 === "IN" ? 0 : iso2 === "US" ? 1 : iso2 === "GB" ? 2 : 10
}
