<script lang="ts">
  import axios from 'axios'
  import { onDestroy } from 'svelte'
  import { apiGetWithRefresh, apiPostWithRefresh, type ApiResponse } from '../lib/api'
  import '../styles/SearchPage.css'

  type Route = '/search' | '/list'
  type MusicClient =
    | 'NeteaseMusicClient'
    | 'QQMusicClient'
    | 'MiguMusicClient'
    | 'KuwoMusicClient'
    | 'QianqianMusicClient'

  interface SearchResult {
    name: string
    artist: string
    url: string
    cover: string
    album: string
  }

  interface SearchResponse {
    ok: boolean
    message: SearchResult[] | string
  }

  type ProgressMessage =
    | number
    | string
    | {
        progress?: number
        percent?: number
        percentage?: number
        status?: string
        message?: string
      }

  const clients: Array<{ label: string; value: MusicClient }> = [
    { label: '网易云', value: 'NeteaseMusicClient' },
    { label: 'QQ音乐', value: 'QQMusicClient' },
    { label: '咪咕音乐', value: 'MiguMusicClient' },
    { label: '酷我音乐', value: 'KuwoMusicClient' },
    { label: '千千音乐', value: 'QianqianMusicClient' },
  ]

  interface Props {
    onNavigate: (path: Route) => void
  }

  let { onNavigate }: Props = $props()
  let keyword = $state('')
  let client = $state<MusicClient>('NeteaseMusicClient')
  let results = $state<SearchResult[]>([])
  let errorMessage = $state('')
  let hasSearched = $state(false)
  let isSearching = $state(false)
  let isDownloading = $state(false)
  let downloadMessage = $state('')
  let downloadProgress = $state<number | null>(null)
  let progressTimer: number | undefined

  onDestroy(() => {
    stopProgressPolling()
  })

  function getErrorMessage(error: unknown) {
    if (axios.isAxiosError<SearchResponse>(error)) {
      const message = error.response?.data?.message

      if (typeof message === 'string') {
        return message
      }
    }

    return '搜索失败，请稍后重试'
  }

  function formatProgress(message: ProgressMessage) {
    if (typeof message === 'number') {
      return `${message}%`
    }

    if (typeof message === 'string') {
      return message
    }

    if (typeof message.message === 'string') {
      return message.message
    }

    if (typeof message.status === 'string') {
      return message.status
    }

    return '正在下载...'
  }

  function getProgressValue(message: ProgressMessage) {
    if (typeof message === 'number') {
      return message
    }

    if (typeof message === 'string') {
      const matched = message.match(/(\d+(?:\.\d+)?)\s*%?/)
      return matched ? Number(matched[1]) : null
    }

    const value = message.progress ?? message.percent ?? message.percentage
    return typeof value === 'number' ? value : null
  }

  function isProgressDone(message: ProgressMessage) {
    const progress = getProgressValue(message)

    if (progress !== null && progress >= 100) {
      return true
    }

    const text =
      typeof message === 'string'
        ? message
        : typeof message === 'number'
          ? String(message)
          : `${message.status ?? ''} ${message.message ?? ''}`

    return /完成|成功|complete|completed|done|finished|success/i.test(text)
  }

  function stopProgressPolling() {
    if (progressTimer !== undefined) {
      window.clearInterval(progressTimer)
      progressTimer = undefined
    }
  }

  async function checkProgress() {
    try {
      const response = await apiGetWithRefresh<ProgressMessage>('/api/progress')

      if (!response.data.ok) {
        downloadMessage =
          typeof response.data.message === 'string' ? response.data.message : '下载进度获取失败'
        return
      }

      downloadMessage = formatProgress(response.data.message)
      downloadProgress = getProgressValue(response.data.message)

      if (isProgressDone(response.data.message)) {
        stopProgressPolling()
        isDownloading = false
        downloadMessage = '下载完成'
        downloadProgress = 100
      }
    } catch {
      downloadMessage = '下载进度获取失败'
    }
  }

  function startProgressPolling() {
    stopProgressPolling()
    void checkProgress()
    progressTimer = window.setInterval(() => {
      void checkProgress()
    }, 1000)
  }

  async function handleSearch(event: SubmitEvent) {
    event.preventDefault()

    if (isDownloading) {
      return
    }

    const trimmedKeyword = keyword.trim()

    if (!trimmedKeyword) {
      errorMessage = '请输入搜索关键词'
      results = []
      hasSearched = false
      return
    }

    errorMessage = ''
    isSearching = true
    hasSearched = true

    try {
      const response = await apiPostWithRefresh<SearchResult[] | string>(
        '/api/search',
        {
          keyword: trimmedKeyword,
          client,
        },
      )

      if (!response.data.ok) {
        errorMessage = typeof response.data.message === 'string' ? response.data.message : '搜索失败'
        results = []
        return
      }

      results = Array.isArray(response.data.message) ? response.data.message : []
    } catch (error) {
      errorMessage = getErrorMessage(error)
      results = []
    } finally {
      isSearching = false
    }
  }

  function goToList() {
    if (isDownloading) {
      return
    }

    onNavigate('/list')
  }

  async function handleDownload(item: SearchResult) {
    if (isSearching || isDownloading) {
      return
    }

    errorMessage = ''
    downloadMessage = '正在创建下载任务...'
    downloadProgress = null
    isDownloading = true

    try {
      const response = await apiPostWithRefresh<string>(
        '/api/download',
        {
          name: item.name,
          artist: item.artist,
          url: item.url,
          cover: item.cover,
          album: item.album,
          quality: '',
        },
      )

      if (!response.data.ok) {
        errorMessage = response.data.message || '下载任务创建失败'
        isDownloading = false
        downloadMessage = ''
        return
      }

      downloadMessage = response.data.message || '正在下载...'
      startProgressPolling()
    } catch (error) {
      errorMessage = getErrorMessage(error)
      isDownloading = false
      downloadMessage = ''
    }
  }

  function logout() {
    localStorage.removeItem('token')
    window.location.reload()
  }
</script>

<main class="search-page">
  <section class="search-panel">
    <header class="search-header">
      <h1>搜索</h1>
      <div class="flex items-center gap-5">
        <nav class="search-tabs" aria-label="页面导航">
          <button class="search-tab active" type="button">搜索</button>
          <button class="search-tab" type="button" onclick={goToList} disabled={isDownloading}>列表</button>
        </nav>
        <button class="btn btn-square" aria-label="注销" onclick={logout}>
          <i class="fa-solid fa-arrow-right-from-bracket"></i>
        </button>
      </div>
    </header>

    <form class="search-form" onsubmit={handleSearch}>
      <select
        class="select select-bordered search-client"
        bind:value={client}
        aria-label="音乐平台"
        disabled={isDownloading}
      >
        {#each clients as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>

      <input
        class="input input-bordered search-input"
        type="search"
        placeholder="输入歌曲、歌手或专辑"
        bind:value={keyword}
        disabled={isDownloading}
      />

      <button class="btn btn-primary search-submit" type="submit" disabled={isSearching || isDownloading}>
        {isSearching ? '搜索中...' : '搜索'}
      </button>
    </form>

    {#if isSearching}
      <div class="search-loading">
        <span class="loading loading-spinner loading-sm" aria-label="正在搜索"></span>
        <span>正在搜索...</span>
      </div>
    {/if}

    {#if isDownloading}
      <div class="download-progress">
        <div class="download-progress-header">
          <span>下载中</span>
          {#if downloadProgress !== null}
            <strong>{Math.min(Math.max(downloadProgress, 0), 100).toFixed(0)}%</strong>
          {:else}
            <strong>{downloadMessage || '等待进度...'}</strong>
          {/if}
        </div>
        {#if downloadProgress !== null}
          <progress class="progress progress-primary" value={Math.min(Math.max(downloadProgress, 0), 100)} max="100">
          </progress>
        {/if}
      </div>
    {/if}

    {#if errorMessage}
      <p class="search-error">{errorMessage}</p>
    {/if}

    <section class="search-results" aria-label="搜索结果">
      {#if results.length > 0}
        {#each results as item}
          <article class="search-result-item">
            <img class="result-cover" src={item.cover} alt={item.name} />
            <div class="result-main">
              <h2>{item.name}</h2>
              <p>{item.artist}</p>
              <span>{item.album || '未知专辑'}</span>
            </div>
            <button
              class="btn btn-outline result-action"
              type="button"
              onclick={() => handleDownload(item)}
              disabled={isSearching || isDownloading}
            >
              下载
            </button>
          </article>
        {/each}
      {:else if hasSearched && !isSearching && !errorMessage}
        <div class="search-empty">没有找到相关结果</div>
      {:else if !hasSearched}
        <div class="search-empty">输入关键词开始搜索</div>
      {/if}
    </section>
  </section>
</main>
