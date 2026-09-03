export type AddressValues = {
  address_line_1: string;
  city: string;
  state: string;
  postal_code: string;
};

export function emptyAddress(): AddressValues {
  return {
    address_line_1: "",
    city: "",
    state: "",
    postal_code: "",
  };
}

export function formatAddressDisplay(address: Partial<AddressValues> | undefined): string {
  if (!address) {
    return "";
  }
  const line1 = address.address_line_1?.trim();
  const city = address.city?.trim();
  const state = address.state?.trim();
  const postal = address.postal_code?.trim();
  const cityLine = [city, state, postal].filter(Boolean).join(", ");
  return [line1, cityLine].filter(Boolean).join(", ");
}

export function addressesEqual(left: AddressValues, right: AddressValues): boolean {
  return (
    left.address_line_1 === right.address_line_1 &&
    left.city === right.city &&
    left.state === right.state &&
    left.postal_code === right.postal_code
  );
}
