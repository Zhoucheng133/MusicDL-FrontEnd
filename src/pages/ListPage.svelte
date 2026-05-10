<script lang="ts">
  import axios from 'axios'
  import { onMount } from 'svelte'
  import '../styles/ListPage.css'

  type Route = '/search' | '/list'

  interface ListResponse {
    ok: boolean
    message: string[] | string
  }

  interface Props {
    onNavigate: (path: Route) => void
  }

  let { onNavigate }: Props = $props()
  let songs = $state<string[]>([])
  let errorMessage = $state('')
  let isLoading = $state(true)
  let downloadingSong = $state('')

  onMount(() => {
    void loadList()
  })

  function getErrorMessage(error: unknown) {
    if (axios.isAxiosError<ListResponse>(error)) {
      const message = error.response?.data?.message

      if (typeof message === 'string') {
        return message
      }
    }

    return '列表加载失败，请稍后重试'
  }

  function getTokenHeader() {
    return {
      token: localStorage.getItem('token') ?? '',
    }
  }

  function parseSong(song: string) {
    const separatorIndex = song.indexOf('-')

    if (separatorIndex === -1) {
      return {
        artist: '',
        name: song,
      }
    }

    return {
      artist: song.slice(0, separatorIndex).trim(),
      name: song.slice(separatorIndex + 1).trim(),
    }
  }

  function getFilename(contentDisposition: string | undefined, fallback: string) {
    if (!contentDisposition) {
      return fallback
    }

    const utf8Filename = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)

    if (utf8Filename?.[1]) {
      return decodeURIComponent(utf8Filename[1])
    }

    const filename = contentDisposition.match(/filename="?([^"]+)"?/i)
    return filename?.[1] ?? fallback
  }

  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function loadList() {
    errorMessage = ''
    isLoading = true

    try {
      const response = await axios.get<ListResponse>('/api/list', {
        headers: getTokenHeader(),
      })

      if (!response.data.ok) {
        errorMessage = typeof response.data.message === 'string' ? response.data.message : '列表加载失败'
        songs = []
        return
      }

      songs = Array.isArray(response.data.message) ? response.data.message : []
    } catch (error) {
      errorMessage = getErrorMessage(error)
      songs = []
    } finally {
      isLoading = false
    }
  }

  function goToSearch() {
    if (downloadingSong) {
      return
    }

    onNavigate('/search')
  }

  async function handleDownload(song: string) {
    if (downloadingSong) {
      return
    }

    const { artist, name } = parseSong(song)

    errorMessage = ''
    downloadingSong = song

    try {
      const response = await axios.get<Blob>('/api/get', {
        headers: getTokenHeader(),
        params: {
          name,
          artist,
        },
        responseType: 'blob',
      })

      const filename = getFilename(response.headers['content-disposition'], `${artist ? `${artist}-` : ''}${name}`)
      saveBlob(response.data, filename)
    } catch {
      errorMessage = '下载失败，请稍后重试'
    } finally {
      downloadingSong = ''
    }
  }
</script>

<main class="list-page">
  <section class="list-panel">
    <header class="list-header">
      <h1>列表</h1>
      <nav class="list-tabs" aria-label="页面导航">
        <button class="list-tab" type="button" onclick={goToSearch} disabled={Boolean(downloadingSong)}>搜索</button>
        <button class="list-tab active" type="button">列表</button>
      </nav>
    </header>

    {#if isLoading}
      <div class="list-state">
        <span class="loading loading-spinner loading-md" aria-label="正在加载"></span>
      </div>
    {:else if errorMessage}
      <p class="list-error">{errorMessage}</p>
    {:else if songs.length > 0}
      <section class="song-list" aria-label="歌曲列表">
        {#each songs as song}
          <article class="song-list-item">
            <span>{song}</span>
            <button
              class="btn btn-outline song-download"
              type="button"
              onclick={() => handleDownload(song)}
              disabled={Boolean(downloadingSong)}
            >
              {downloadingSong === song ? '下载中...' : '下载'}
            </button>
          </article>
        {/each}
      </section>
    {:else}
      <div class="list-state">列表为空</div>
    {/if}
  </section>
</main>
