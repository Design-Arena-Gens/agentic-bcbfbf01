'use client'

import { useState } from 'react'
import styles from './page.module.css'

interface SubdomainResult {
  subdomain: string
  ip?: string
  status: 'active' | 'inactive' | 'checking'
  method: string
}

export default function Home() {
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SubdomainResult[]>([])
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [method, setMethod] = useState<'dictionary' | 'bruteforce' | 'all'>('dictionary')

  const startScan = async () => {
    if (!domain) return

    setLoading(true)
    setResults([])
    setProgress({ current: 0, total: 0 })

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain, method }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) return

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'result') {
                setResults(prev => [...prev, data.result])
              } else if (data.type === 'progress') {
                setProgress(data.progress)
              } else if (data.type === 'complete') {
                setLoading(false)
              }
            } catch (e) {
              console.error('Parse error:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Scan error:', error)
      setLoading(false)
    }
  }

  const exportResults = () => {
    const activeResults = results.filter(r => r.status === 'active')
    const text = activeResults.map(r => `${r.subdomain},${r.ip || 'N/A'},${r.method}`).join('\n')
    const blob = new Blob([`Subdomain,IP Address,Method\n${text}`], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${domain}_subdomains.csv`
    a.click()
  }

  const activeCount = results.filter(r => r.status === 'active').length

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            <span className={styles.icon}>🎯</span>
            SubFinder Pro
          </h1>
          <p className={styles.subtitle}>Advanced Subdomain Enumeration Tool</p>
        </header>

        <div className={styles.inputSection}>
          <div className={styles.inputGroup}>
            <input
              type="text"
              className={styles.input}
              placeholder="Enter target domain (e.g., example.com)"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className={styles.methodSelector}>
            <label className={styles.methodLabel}>Enumeration Method:</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  value="dictionary"
                  checked={method === 'dictionary'}
                  onChange={(e) => setMethod(e.target.value as any)}
                  disabled={loading}
                />
                <span>Dictionary (Fast)</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  value="bruteforce"
                  checked={method === 'bruteforce'}
                  onChange={(e) => setMethod(e.target.value as any)}
                  disabled={loading}
                />
                <span>Bruteforce (Thorough)</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  value="all"
                  checked={method === 'all'}
                  onChange={(e) => setMethod(e.target.value as any)}
                  disabled={loading}
                />
                <span>All Methods</span>
              </label>
            </div>
          </div>

          <button
            className={styles.scanButton}
            onClick={startScan}
            disabled={loading || !domain}
          >
            {loading ? (
              <>
                <span className={styles.spinner}></span>
                Scanning...
              </>
            ) : (
              <>
                <span>🔍</span>
                Start Scan
              </>
            )}
          </button>
        </div>

        {loading && (
          <div className={styles.progressSection}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              ></div>
            </div>
            <p className={styles.progressText}>
              Testing {progress.current} of {progress.total} subdomains...
            </p>
          </div>
        )}

        {results.length > 0 && (
          <div className={styles.resultsSection}>
            <div className={styles.resultsHeader}>
              <h2 className={styles.resultsTitle}>
                Results: {activeCount} Active Subdomain{activeCount !== 1 ? 's' : ''}
              </h2>
              {activeCount > 0 && (
                <button className={styles.exportButton} onClick={exportResults}>
                  📥 Export CSV
                </button>
              )}
            </div>

            <div className={styles.resultsList}>
              {results
                .filter(r => r.status === 'active')
                .map((result, index) => (
                  <div key={index} className={styles.resultItem}>
                    <div className={styles.resultInfo}>
                      <span className={styles.statusIndicator}>🟢</span>
                      <div className={styles.resultDetails}>
                        <div className={styles.subdomain}>{result.subdomain}</div>
                        {result.ip && (
                          <div className={styles.ip}>IP: {result.ip}</div>
                        )}
                      </div>
                    </div>
                    <span className={styles.method}>{result.method}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🔎</div>
            <p>Enter a domain and start scanning to discover subdomains</p>
          </div>
        )}
      </div>
    </main>
  )
}
