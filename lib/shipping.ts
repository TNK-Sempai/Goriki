import { SHIPPING_RATES } from './constants'

export interface ShippingOption {
  id: string
  displayName: string
  amount: number // CENTIMES
  currency: 'eur'
  minDeliveryDays?: number
  maxDeliveryDays?: number
}

export interface ShippingQuoteInput {
  subtotal: number // CENTIMES, marchandises, AVANT store_credit
}

export interface ShippingProvider {
  getOptions(input: ShippingQuoteInput): Promise<ShippingOption[]>
}

const BE_AMOUNT = Math.round(SHIPPING_RATES.BE * 100)
const EU_AMOUNT = Math.round(SHIPPING_RATES.EU * 100)
const FREE_THRESHOLD_AMOUNT = Math.round(SHIPPING_RATES.FREE_THRESHOLD * 100)

export class FlatRateProvider implements ShippingProvider {
  async getOptions(input: ShippingQuoteInput): Promise<ShippingOption[]> {
    if (input.subtotal >= FREE_THRESHOLD_AMOUNT) {
      return [{ id: 'free', displayName: 'Livraison offerte', amount: 0, currency: 'eur' }]
    }

    return [
      { id: 'flat-be', displayName: 'Belgique', amount: BE_AMOUNT, currency: 'eur' },
      { id: 'flat-eu', displayName: 'France · Luxembourg · Pays-Bas · Allemagne', amount: EU_AMOUNT, currency: 'eur' },
    ]
  }
}

export function getShippingProvider(): ShippingProvider {
  return new FlatRateProvider()
}
