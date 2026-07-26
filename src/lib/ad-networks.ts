/**
 * Multi-Network Ad Integration System
 * 
 * Supports multiple ad networks with automatic fallback and
 * eCPM-based "waterfall" display logic.
 * 
 * Each network is only enabled if its API keys are configured in .env
 * If no keys are set for a network, it's skipped entirely to prevent
 * blank spaces or console errors.
 * 
 * Networks supported:
 * 1. Google AdSense (primary - configured)
 * 2. Media.net (requires VITE_MEDIANET_CID + VITE_MEDIANET_CRID)
 * 3. Carbon Ads (requires VITE_CARBON_SERVE)
 * 4. PropellerAds (requires VITE_PROPELLER_ZONE)
 * 5. MGID (requires VITE_MGID_ID)
 * 6. Infolinks (requires VITE_INFOLINKS_PID)
 * 7. BuySellAds (requires VITE_BSA_ID)
 */

export type AdNetwork = 'adsense' | 'medianet' | 'propeller' | 'buysellads' | 'carbon' | 'mgid' | 'infolinks';

export interface AdConfig {
  network: AdNetwork;
  priority: number; // 1 = highest priority
  enabled: boolean;
  revenueShare?: number;
  ecpm?: number;       // estimated eCPM in dollars — used for waterfall ordering
  slotId?: string;
  clientId?: string;
  zoneId?: string;
}

export interface AdUnit {
  id: string;
  network: AdNetwork;
  format: 'banner' | 'rectangle' | 'skyscraper' | 'native' | 'popunder';
  priority: number;
  html: string;
  script?: string;
}

/**
 * Check if a specific ad network has its API keys configured in .env
 * Returns false if the key is empty or still has the placeholder value
 */
function isNetworkConfigured(network: AdNetwork): boolean {
  switch (network) {
    case 'adsense': {
      const id = import.meta.env.VITE_ADSENSE_CLIENT_ID || import.meta.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || '';
      return id !== '' && !id.includes('XXXXXXXXXXXX') && !id.includes('XXXXXXXXXXXXXXXX');
    }
    case 'medianet': {
      const cid = import.meta.env.VITE_MEDIANET_CID || '';
      const crid = import.meta.env.VITE_MEDIANET_CRID || '';
      return cid !== '' && crid !== '' && !cid.includes('XXXX');
    }
    case 'carbon': {
      const serve = import.meta.env.VITE_CARBON_SERVE || '';
      return serve !== '' && !serve.includes('XXXX');
    }
    case 'propeller': {
      const zone = import.meta.env.VITE_PROPELLER_ZONE || '';
      return zone !== '' && !zone.includes('XXXX');
    }
    case 'mgid': {
      const id = import.meta.env.VITE_MGID_ID || '';
      return id !== '' && !id.includes('XXXX');
    }
    case 'infolinks': {
      const pid = import.meta.env.VITE_INFOLINKS_PID || '';
      return pid !== '' && !pid.includes('XXXX');
    }
    case 'buysellads': {
      const id = import.meta.env.VITE_BSA_ID || '';
      return id !== '' && !id.includes('XXXX');
    }
    default:
      return false;
  }
}

/**
 * Build the list of enabled ad networks based on .env configuration.
 * Only networks with valid API keys are included.
 * Networks are sorted by eCPM (highest first) for waterfall logic.
 */
function getEnabledAdConfigs(): AdConfig[] {
  const allConfigs: AdConfig[] = [
    // AdSense typically has the highest eCPM (~$5.00)
    { network: 'adsense', priority: 1, enabled: true, revenueShare: 0.68, ecpm: 5.00 },
    // Media.net ~$2.50 eCPM
    { network: 'medianet', priority: 2, enabled: true, revenueShare: 0.55, ecpm: 2.50 },
    // Carbon Ads ~$3.00 eCPM (tech audience)
    { network: 'carbon', priority: 3, enabled: true, revenueShare: 0.45, ecpm: 3.00 },
    // PropellerAds ~$0.50 eCPM (high fill rate, lower CPM)
    { network: 'propeller', priority: 4, enabled: true, revenueShare: 0.35, ecpm: 0.50 },
    // MGID ~$1.50 eCPM
    { network: 'mgid', priority: 5, enabled: true, revenueShare: 0.30, ecpm: 1.50 },
    // Infolinks ~$0.80 eCPM
    { network: 'infolinks', priority: 6, enabled: true, revenueShare: 0.25, ecpm: 0.80 },
    // BuySellAds ~$2.00 eCPM
    { network: 'buysellads', priority: 7, enabled: true, revenueShare: 0.20, ecpm: 2.00 },
  ];

  // Filter: only keep networks that have their API keys configured
  const enabled = allConfigs.filter(c => isNetworkConfigured(c.network));

  // Sort by eCPM descending (highest paying first) — this is the waterfall order
  enabled.sort((a, b) => (b.ecpm ?? 0) - (a.ecpm ?? 0));

  return enabled;
}

/**
 * Get the best ad network based on eCPM (highest paying first).
 * Falls back through the list if a network fails to load.
 * Only returns networks that have valid API keys configured.
 */
export function getBestAdNetwork(): AdNetwork {
  const enabled = getEnabledAdConfigs();
  
  // If no networks are configured, return adsense as default (it has fallback values)
  if (enabled.length === 0) return 'adsense';
  
  // Return the highest eCPM network first
  return enabled[0].network;
}

/**
 * Get the full ordered waterfall list of enabled ad networks.
 * Networks are sorted by eCPM descending (highest first).
 * The AdBanner component can iterate through this list on failure.
 * 
 * Usage:
 *   const waterfall = getAdWaterfall();
 *   // Try waterfall[0], on error try waterfall[1], etc.
 */
export function getAdWaterfall(): AdNetwork[] {
  return getEnabledAdConfigs().map(c => c.network);
}

/**
 * Get the next network in the waterfall after the given one.
 * Returns null if there are no more networks to try.
 */
export function getNextWaterfallNetwork(current: AdNetwork): AdNetwork | null {
  const waterfall = getAdWaterfall();
  const currentIndex = waterfall.indexOf(current);
  if (currentIndex === -1 || currentIndex >= waterfall.length - 1) return null;
  return waterfall[currentIndex + 1];
}

/**
 * Get ad HTML for a specific network and format
 */
export function getAdHtml(network: AdNetwork, format: 'horizontal' | 'rectangle' | 'vertical'): AdUnit {
  const id = `ad-${network}-${format}-${Date.now()}`;
  
  switch (network) {
    case 'adsense':
      return {
        id,
        network: 'adsense',
        format: format === 'horizontal' ? 'banner' : format === 'rectangle' ? 'rectangle' : 'skyscraper',
        priority: 1,
        html: `<ins class="adsbygoogle"
          style="display:block;${format === 'horizontal' ? 'min-width:300px;width:100%;height:90px' : format === 'rectangle' ? 'min-width:250px;width:100%;height:250px' : 'min-width:160px;width:160px;height:600px'}"
          data-ad-client="${import.meta.env.VITE_ADSENSE_CLIENT_ID || import.meta.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || 'ca-pub-8107638298388341'}"
          data-ad-slot="${import.meta.env.VITE_ADSENSE_SLOT || 'XXXXXXXXXX'}"
          data-ad-format="${format === 'horizontal' ? 'auto' : format}"
          data-full-width-responsive="true"></ins>`,
        script: `try{(adsbygoogle=window.adsbygoogle||[]).push({})}catch(e){}`,
      };

    case 'medianet':
      return {
        id,
        network: 'medianet',
        format: 'banner',
        priority: 2,
        html: `<div id="medianet-${id}" style="min-width:300px;min-height:250px">
          <script type="text/javascript">
            window.medianet_width = "${format === 'horizontal' ? '728' : '300'}";
            window.medianet_height = "${format === 'horizontal' ? '90' : '250'}";
            window.medianet_crid = "${import.meta.env.VITE_MEDIANET_CRID || ''}";
            window.medianet_version = "1.0";
          </script>
          <script type="text/javascript" src="//contextual.media.net/nmedianet.js?cid=${import.meta.env.VITE_MEDIANET_CID || ''}"></script>
        </div>`,
      };

    case 'propeller':
      return {
        id,
        network: 'propeller',
        format: 'banner',
        priority: 4,
        html: `<div id="propeller-${id}" style="min-width:300px;min-height:250px">
          <script type="text/javascript" src="//propellerads.com/ad.js?zone=${import.meta.env.VITE_PROPELLER_ZONE || ''}&format=${format === 'horizontal' ? 'banner' : 'rectangle'}&width=${format === 'horizontal' ? '728' : '300'}&height=${format === 'horizontal' ? '90' : '250'}"></script>
        </div>`,
      };

    case 'carbon':
      return {
        id,
        network: 'carbon',
        format: 'rectangle',
        priority: 3,
        html: `<div id="carbonads-${id}" style="min-width:300px;min-height:250px">
          <script type="text/javascript" src="//cdn.carbonads.com/carbon.js?serve=${import.meta.env.VITE_CARBON_SERVE || ''}&placement=dxfix"></script>
        </div>`,
      };

    case 'mgid':
      return {
        id,
        network: 'mgid',
        format: 'native',
        priority: 5,
        html: `<div id="mgid-${id}" style="min-width:300px;min-height:250px" data-mgid="${import.meta.env.VITE_MGID_ID || ''}">
          <script src="//jsc.mgid.com/d/x/dxfix.${import.meta.env.VITE_MGID_SITE || 'site'}.js?t=${Date.now()}" async></script>
        </div>`,
      };

    case 'infolinks':
      return {
        id,
        network: 'infolinks',
        format: 'native',
        priority: 6,
        html: `<div id="infolinks-${id}">
          <script type="text/javascript">
            var infolinks_pid = ${import.meta.env.VITE_INFOLINKS_PID || '0'};
            var infolinks_wsid = ${import.meta.env.VITE_INFOLINKS_WSID || '0'};
          </script>
          <script type="text/javascript" src="//resources.infolinks.com/js/infolinks_main.js"></script>
        </div>`,
      };

    case 'buysellads':
      return {
        id,
        network: 'buysellads',
        format: 'banner',
        priority: 7,
        html: `<div id="bsa-${id}" style="min-width:300px;min-height:250px">
          <script type="text/javascript">
            (function(){
              if(typeof _bsa !== 'undefined' && _bsa) {
                _bsa.init('${import.meta.env.VITE_BSA_ID || 'default'}', '${import.meta.env.VITE_BSA_ZONE || 'default'}', 'placement:dxfix');
              }
            })();
          </script>
        </div>`,
      };

    default:
      return getAdHtml('adsense', format);
  }
}

/**
 * Get all available ad networks that are actually configured
 */
export function getSupportedNetworks(): string[] {
  return getEnabledAdConfigs().map(c => c.network);
}

/**
 * Check if any ad network is configured (has real API keys)
 */
export function hasConfiguredAds(): boolean {
  return getEnabledAdConfigs().length > 0;
}