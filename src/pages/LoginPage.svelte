<script lang="ts">
  import axios from 'axios'
  import '../styles/LoginPage.css'

  interface AuthResponse {
    ok: boolean
    message?: unknown
    token?: string
  }

  interface Props {
    onAuthenticated: () => void
  }

  let { onAuthenticated }: Props = $props()
  let username = $state('')
  let password = $state('')
  let errorMessage = $state('')
  let isSubmitting = $state(false)

  function getToken(data: AuthResponse) {
    if (typeof data.token === 'string') {
      return data.token
    }

    if (typeof data.message === 'string') {
      return data.message
    }

    return ''
  }

  function getErrorMessage(error: unknown) {
    if (axios.isAxiosError<AuthResponse>(error)) {
      const message = error.response?.data?.message

      if (typeof message === 'string') {
        return message
      }
    }

    return '登录失败，请稍后重试'
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    errorMessage = ''
    isSubmitting = true

    try {
      const result = await axios.post<AuthResponse>('/api/login', {
        username,
        password,
      })

      if (!result.data.ok) {
        errorMessage = typeof result.data.message === 'string' ? result.data.message : '用户名或密码错误'
        return
      }

      const token = getToken(result.data)

      if (!token) {
        errorMessage = '登录成功但没有返回 token'
        return
      }

      localStorage.setItem('token', token)
      onAuthenticated()
    } catch (error) {
      errorMessage = getErrorMessage(error)
    } finally {
      isSubmitting = false
    }
  }

</script>

<main class="login-shell">
  <section class="login-panel">
    <div class="login-brand-mark">
      <img src="/icon.png" alt="MusicDL" />
    </div>
    <div class="login-heading">
      <p class="login-eyebrow">MusicDL</p>
      <h1>欢迎回来</h1>
      <p>登录后继续管理你的音乐下载任务。</p>
    </div>

    <form class="login-form" onsubmit={handleSubmit}>
      <label class="login-form-control">
        <span>用户名</span>
        <input
          class="input input-bordered"
          type="text"
          placeholder="请输入用户名"
          autocomplete="username"
          bind:value={username}
          required
        />
      </label>

      <label class="login-form-control">
        <span>密码</span>
        <input
          class="input input-bordered"
          type="password"
          placeholder="请输入密码"
          autocomplete="current-password"
          bind:value={password}
          required
        />
      </label>

      {#if errorMessage}
        <p class="login-error">{errorMessage}</p>
      {/if}

      <button class="btn btn-primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? '登录中...' : '登录'}
      </button>
    </form>

  </section>
</main>
