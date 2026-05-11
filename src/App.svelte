<script lang="ts">
  import axios from 'axios'
  import { onMount } from 'svelte'
  import LoginPage from './pages/LoginPage.svelte'
  import RegisterPage from './pages/RegisterPage.svelte'
  import SearchPage from './pages/SearchPage.svelte'
  import ListPage from './pages/ListPage.svelte'
  import { apiGetWithRefresh, type ApiResponse } from './lib/api'

  type Route = '/' | '/login' | '/register' | '/search' | '/list'
  type AuthRoute = '/search' | '/list'

  let currentPath = $state<Route>('/login')
  let isChecking = $state(true)
  let routeRequestId = 0

  onMount(() => {
    void resolveRoute(window.location.pathname, true)

    function handlePopState() {
      void resolveRoute(window.location.pathname, true)
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  })

  function normalizeRoute(pathname: string): Route {
    if (pathname === '/register') {
      return '/register'
    }

    if (pathname === '/search' || pathname === '/list') {
      return pathname
    }

    if (pathname === '/') {
      return '/'
    }

    return '/login'
  }

  function clearStoredAuth() {
    localStorage.removeItem('token')
  }

  function setRoute(path: Route, replace: boolean) {
    if (window.location.pathname !== path) {
      if (replace) {
        window.history.replaceState({}, '', path)
      } else {
        window.history.pushState({}, '', path)
      }
    }

    currentPath = path
  }

  async function resolveRoute(pathname: string, replace = false) {
    const requestId = ++routeRequestId
    const requestedRoute = normalizeRoute(pathname)

    isChecking = true

    try {
      const noUserResult = await axios.get<ApiResponse<boolean>>('/api/nouser')

      if (noUserResult.data.ok && noUserResult.data.message === true) {
        if (requestId === routeRequestId) {
          setRoute('/register', replace)
        }

        return
      }

      const token = localStorage.getItem('token')

      if (!token) {
        clearStoredAuth()

        if (requestId === routeRequestId) {
          setRoute('/login', replace)
        }

        return
      }

      const checkResult = await apiGetWithRefresh<string>('/api/check')

      if (checkResult.data.ok) {
        if (requestId === routeRequestId) {
          setRoute(getAuthenticatedRoute(requestedRoute), replace)
        }

        return
      }

      clearStoredAuth()

      if (requestId === routeRequestId) {
        setRoute('/login', replace)
      }
    } catch {
      clearStoredAuth()

      if (requestId === routeRequestId) {
        setRoute(requestedRoute === '/register' ? '/register' : '/login', replace)
      }
    } finally {
      if (requestId === routeRequestId) {
        isChecking = false
      }
    }
  }

  function navigate(path: Route) {
    if (isAuthenticatedPage(currentPath) && isAuthenticatedPage(path)) {
      setRoute(path, false)
      return
    }

    void resolveRoute(path)
  }

  function handleAuthenticated() {
    void resolveRoute('/search')
  }

  function getAuthenticatedRoute(route: Route): AuthRoute {
    if (route === '/list') {
      return '/list'
    }

    return '/search'
  }

  function isAuthenticatedPage(route: Route): route is AuthRoute {
    return route === '/search' || route === '/list'
  }
</script>

{#if isChecking}
  <main class="loading-shell">
    <span class="loading loading-spinner loading-md" aria-label="正在加载"></span>
  </main>
{:else if currentPath === '/list'}
  <ListPage onNavigate={navigate} />
{:else if currentPath === '/search'}
  <SearchPage onNavigate={navigate} />
{:else if currentPath === '/register'}
  <RegisterPage onAuthenticated={handleAuthenticated} onNavigate={navigate} />
{:else}
  <LoginPage onAuthenticated={handleAuthenticated} />
{/if}
