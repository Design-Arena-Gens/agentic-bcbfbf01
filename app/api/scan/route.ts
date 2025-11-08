import { NextRequest } from 'next/server'

const COMMON_SUBDOMAINS = [
  'www', 'mail', 'ftp', 'localhost', 'webmail', 'smtp', 'pop', 'ns1', 'webdisk',
  'ns2', 'cpanel', 'whm', 'autodiscover', 'autoconfig', 'm', 'imap', 'test',
  'ns', 'blog', 'pop3', 'dev', 'www2', 'admin', 'forum', 'news', 'vpn',
  'ns3', 'mail2', 'new', 'mysql', 'old', 'lists', 'support', 'mobile', 'mx',
  'static', 'docs', 'beta', 'shop', 'sql', 'secure', 'demo', 'cp', 'calendar',
  'wiki', 'web', 'media', 'email', 'images', 'img', 'www1', 'intranet', 'portal',
  'video', 'sip', 'dns2', 'api', 'cdn', 'stats', 'dns1', 'ns4', 'www3', 'dns',
  'search', 'staging', 'server', 'mx1', 'chat', 'wap', 'my', 'svn', 'mail1',
  'sites', 'proxy', 'ads', 'host', 'crm', 'cms', 'backup', 'mx2', 'lyncdiscover',
  'info', 'apps', 'download', 'remote', 'db', 'forums', 'store', 'relay',
  'files', 'newsletter', 'app', 'live', 'owa', 'en', 'start', 'sms', 'office',
  'exchange', 'ipv4', 'mail3', 'help', 'blogs', 'helpdesk', 'web1', 'home',
  'library', 'ftp2', 'ntp', 'monitor', 'login', 'service', 'correo', 'www4',
  'moodle', 'it', 'gateway', 'gw', 'i', 'stat', 'stage', 'ldap', 'tv', 'ssl',
  'web2', 'ns5', 'upload', 'nagios', 'smtp2', 'online', 'ad', 'survey',
  'data', 'radio', 'extranet', 'test2', 'mssql', 'dns3', 'jobs', 'services',
  'panel', 'irc', 'hosting', 'cloud', 'de', 'gmail', 's', 'bbs', 'cs',
  'ww', 'mrtg', 'git', 'image', 'members', 'pda', 'vps', 'www5', 'finance',
  'upload1', 'mail4', 'prod', 'sandbox', 'api2', 'monitoring', 'status'
]

const BRUTEFORCE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789-'

function generateBruteforceSubdomains(maxLength: number = 3, limit: number = 200): string[] {
  const subdomains: string[] = []

  // Single character
  for (const char of BRUTEFORCE_CHARS.replace('-', '')) {
    subdomains.push(char)
    if (subdomains.length >= limit) return subdomains
  }

  // Two characters
  for (const char1 of BRUTEFORCE_CHARS.replace('-', '')) {
    for (const char2 of BRUTEFORCE_CHARS) {
      if (char2 === '-') continue
      subdomains.push(char1 + char2)
      if (subdomains.length >= limit) return subdomains
    }
  }

  // Three characters (limited)
  const common = 'abcdefghijklmnopqrstuvwxyz'
  for (const char1 of common) {
    for (const char2 of common) {
      for (const char3 of common.substring(0, 5)) {
        subdomains.push(char1 + char2 + char3)
        if (subdomains.length >= limit) return subdomains
      }
    }
  }

  return subdomains
}

async function checkSubdomain(subdomain: string, domain: string): Promise<{ active: boolean; ip?: string }> {
  const fullDomain = `${subdomain}.${domain}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const response = await fetch(`https://${fullDomain}`, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'manual',
    }).catch(() => null)

    clearTimeout(timeout)

    if (response && (response.status < 400 || response.status === 401 || response.status === 403)) {
      return { active: true }
    }

    // Try DNS lookup via public API
    try {
      const dnsResponse = await fetch(`https://dns.google/resolve?name=${fullDomain}&type=A`)
      const dnsData = await dnsResponse.json()

      if (dnsData.Answer && dnsData.Answer.length > 0) {
        const ip = dnsData.Answer[0].data
        return { active: true, ip }
      }
    } catch (e) {
      // DNS lookup failed
    }

    return { active: false }
  } catch (error) {
    return { active: false }
  }
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  const { domain, method } = await request.json()

  if (!domain) {
    return new Response('Domain is required', { status: 400 })
  }

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]

  let subdomainsToCheck: string[] = []

  if (method === 'dictionary' || method === 'all') {
    subdomainsToCheck.push(...COMMON_SUBDOMAINS)
  }

  if (method === 'bruteforce' || method === 'all') {
    const bruteforce = generateBruteforceSubdomains(3, 150)
    subdomainsToCheck.push(...bruteforce.filter(s => !subdomainsToCheck.includes(s)))
  }

  const stream = new ReadableStream({
    async start(controller) {
      const total = subdomainsToCheck.length
      let current = 0

      // Process in batches
      const batchSize = 10
      for (let i = 0; i < subdomainsToCheck.length; i += batchSize) {
        const batch = subdomainsToCheck.slice(i, i + batchSize)

        const results = await Promise.all(
          batch.map(async (subdomain) => {
            const result = await checkSubdomain(subdomain, cleanDomain)
            current++

            // Send progress
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'progress',
                  progress: { current, total }
                })}\n\n`
              )
            )

            if (result.active) {
              const resultData = {
                subdomain: `${subdomain}.${cleanDomain}`,
                ip: result.ip,
                status: 'active' as const,
                method: method === 'all'
                  ? (COMMON_SUBDOMAINS.includes(subdomain) ? 'Dictionary' : 'Bruteforce')
                  : method === 'dictionary' ? 'Dictionary' : 'Bruteforce'
              }

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'result',
                    result: resultData
                  })}\n\n`
                )
              )
            }

            return result
          })
        )

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'complete' })}\n\n`
        )
      )

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
