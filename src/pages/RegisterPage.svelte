<script lang="ts">
  import axios from 'axios'
  import '../styles/RegisterPage.css'

  type Route = '/login' | '/register'

  interface AuthResponse {
    ok: boolean
    message?: unknown
    token?: string
  }

  interface Props {
    onAuthenticated: () => void
    onNavigate: (path: Route) => void
  }

  let { onAuthenticated, onNavigate }: Props = $props()
  let username = $state('')
  let password = $state('')
  let confirmPassword = $state('')
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

    return '注册失败，请稍后重试'
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    errorMessage = ''

    if (password !== confirmPassword) {
      errorMessage = '两次输入的密码不一致'
      return
    }

    isSubmitting = true

    try {
      const result = await axios.post<AuthResponse>('/api/register', {
        username,
        password,
      })

      if (!result.data.ok) {
        errorMessage = typeof result.data.message === 'string' ? result.data.message : '注册失败'
        return
      }

      const token = getToken(result.data)

      if (token) {
        localStorage.setItem('token', token)
        onAuthenticated()
        return
      }

      onNavigate('/login')
    } catch (error) {
      errorMessage = getErrorMessage(error)
    } finally {
      isSubmitting = false
    }
  }

  function goToLogin(event: MouseEvent) {
    event.preventDefault()
    onNavigate('/login')
  }
</script>

<main class="register-shell">
  <section class="register-panel">
    <div class="register-brand-mark">
      <img src="/icon.png" alt="MusicDL" />
    </div>
    <div class="register-heading">
      <p class="register-eyebrow">MusicDL</p>
      <h1>创建账号</h1>
      <p>注册后开始保存歌单、下载记录和常用设置。</p>
    </div>

    <form class="register-form" onsubmit={handleSubmit}>
      <label class="register-form-control">
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

      <label class="register-form-control">
        <span>密码</span>
        <input
          class="input input-bordered"
          type="password"
          placeholder="至少 8 位字符"
          autocomplete="new-password"
          bind:value={password}
          required
        />
      </label>

      <label class="register-form-control">
        <span>确认密码</span>
        <input
          class="input input-bordered"
          type="password"
          placeholder="再次输入密码"
          autocomplete="new-password"
          bind:value={confirmPassword}
          required
        />
      </label>

      {#if errorMessage}
        <p class="register-error">{errorMessage}</p>
      {/if}

      <button class="btn btn-primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? '注册中...' : '注册'}
      </button>
    </form>

    <p class="register-switch">
      已有账号？
      <a href="/login" onclick={goToLogin}>返回登录</a>
    </p>
  </section>
</main>
