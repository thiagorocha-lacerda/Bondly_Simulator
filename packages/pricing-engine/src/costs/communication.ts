/** Custo unitário de comunicação (R-006). */
import type { CommunicationTariffs } from '../premises/premises.js';
import type { ChannelMix, CommunicationStrategy } from '../contracts/types.js';

/**
 * Custo unitário de comunicação por estratégia (R-006), reproduzindo `commUnit()` do HTML:
 *  - custom: Σ mix×tarifa
 *  - none: 0
 *  - rcs/wa/sms/email: tarifa do canal
 *  - both: rcs + wa
 *  - fallback (default): rcs + wa×fallbackRate
 */
export function communicationUnitCost(
  strategy: CommunicationStrategy,
  fallbackRate: number,
  mix: ChannelMix,
  tariffs: CommunicationTariffs,
): number {
  switch (strategy) {
    case 'custom':
      return mix.sms * tariffs.sms + mix.email * tariffs.email + mix.rcs * tariffs.rcs + mix.wa * tariffs.wa;
    case 'none':
      return 0;
    case 'rcs':
      return tariffs.rcs;
    case 'wa':
      return tariffs.wa;
    case 'sms':
      return tariffs.sms;
    case 'email':
      return tariffs.email;
    case 'both':
      return tariffs.rcs + tariffs.wa;
    case 'fallback':
    default:
      return tariffs.rcs + tariffs.wa * fallbackRate;
  }
}
