export const STORE_CONFIG = {
  brandName: "THE URBAN STYLE",
  address:
    "Behind RPS Inter College, Itaunja, Lucknow, Uttar Pradesh, India - 226203",

  googleMapsUrl: "https://share.google/ShFZrr0ezlU90nLbI",

  delivery: {
    enabled: true,
    maximumRadiusKm: 10,
    standardRadiusKm: 5,
    allowStorePickup: true,
    chargesManagedByAdmin: true,
  },

  contact: {
    phone: "8090365996",
    alternatePhone: "7388026659",
    whatsapp: "https://wa.me/918090365996",
  },
} as const;
