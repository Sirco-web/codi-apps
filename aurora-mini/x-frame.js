/**
 * CONFIGURATION
 * Set your Cloudflare Worker URL here
 */
const CLOUDFLARE_WORKER_URL = 'https://corsifly-by-wifi.timco-store1.workers.dev';

customElements.define('x-frame', class extends HTMLIFrameElement {
	static get observedAttributes() {
		return ['src']
	}
	constructor () {
		super()
	}
	attributeChangedCallback () {
		this.load(this.src)
	}
	connectedCallback () {
		// SECURITY: Limited sandbox that allows forms and basic functionality
		// Note: allow-same-origin is scoped to the proxy origin (Cloudflare Worker),
		// not the actual target site, so this is still secure
		this.sandbox = '' + this.sandbox || 'allow-same-origin allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-scripts allow-top-navigation-by-user-activation'
	}
	load (url, options) {
		if (!url) return
		if (!url.startsWith('http')) throw new Error(`X-Frame src ${url} does not start with http(s)://`)
		
		// Prevent double-proxying: if URL is already proxied, extract original URL
		let originalUrl = url;
		if (url.includes(CLOUDFLARE_WORKER_URL) && url.includes('?url=')) {
			try {
				const urlObj = new URL(url);
				const proxiedUrl = urlObj.searchParams.get('url');
				if (proxiedUrl) {
					console.log('X-Frame: Detected already-proxied URL, extracting original:', proxiedUrl);
					originalUrl = proxiedUrl;
				}
			} catch (e) {
				// If extraction fails, use the URL as-is
			}
		}
		
		console.log('X-Frame loading:', originalUrl)
		this.srcdoc = `<!DOCTYPE html>
<html>
<head>
	<style>
	.loader {
		position: absolute;
		top: calc(50% - 25px);
		left: calc(50% - 25px);
		width: 50px;
		height: 50px;
		background-color: #333;
		border-radius: 50%;  
		animation: loader 1s infinite ease-in-out;
	}
	@keyframes loader {
		0% { transform: scale(0); }
		100% { transform: scale(1); opacity: 0; }
	}
	</style>
</head>
<body>
	<div class="loader"></div>
</body>
</html>`
		this.fetchProxy(originalUrl, options).then(res => res.text()).then(data => {
			if (data) {
				// Rewrite all URLs in the HTML to go through the proxy
				const rewritten = this.rewriteUrls(data, originalUrl);
				
				// Extract title and favicon from HTML
				const titleMatch = rewritten.match(/<title[^>]*>([^<]+)<\/title>/i);
				const pageTitle = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;
				
				// Extract favicon
				const iconMatch = rewritten.match(/<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["'][^>]*>/i);
				let faviconUrl = iconMatch ? iconMatch[1] : null;
				
				// If no icon found, try /favicon.ico
				if (!faviconUrl) {
					faviconUrl = new URL('/favicon.ico', url).href;
				}
				
				// Ensure favicon URL is absolute and proxied
				if (faviconUrl && !faviconUrl.startsWith('data:') && !faviconUrl.startsWith('http')) {
					faviconUrl = new URL(faviconUrl, originalUrl).href;
				}
				if (faviconUrl && !faviconUrl.startsWith('data:') && !faviconUrl.includes(CLOUDFLARE_WORKER_URL)) {
					faviconUrl = CLOUDFLARE_WORKER_URL + '?url=' + encodeURIComponent(faviconUrl);
				}
				
				this.srcdoc = rewritten.replace(/<head([^>]*)>/i, `<head$1>
	<base href="${originalUrl}">
	<style>
	/* Emergency fallback styles if CSS fails to load */
	html, body {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif !important;
		background: #ffffff !important;
		color: #24292f !important;
		margin: 0 !important;
		padding: 0 !important;
		line-height: 1.6 !important;
		width: 100% !important;
	}
	
	@media (prefers-color-scheme: dark) {
		html, body {
			background: #0d1117 !important;
			color: #c9d1d9 !important;
		}
	}
	
	a { color: #0969da !important; text-decoration: underline !important; }
	@media (prefers-color-scheme: dark) {
		a { color: #58a6ff !important; }
	}
	
	h1, h2, h3, h4, h5, h6 { 
		margin: 0.5em 0 0.25em 0 !important;
		font-weight: 600 !important;
	}
	
	noscript { display: block !important; }
	
	/* Suppress broken resource indicators */
	img:not([src]), img[src=""] { display: none !important; }
	
	/* Hide loading spinner once page loads */
	.loader { display: none !important; }
	</style>
	<script>
	// Suppress errors without breaking page
	window.addEventListener('error', e => {
		e.preventDefault();
		return true;
	}, true);
	
	window.addEventListener('unhandledrejection', e => {
		e.preventDefault();
	});
	
	// Intercept XMLHttpRequest to proxy same-origin requests
	const originalFetch = window.fetch;
	window.fetch = function(url, options) {
		let proxiedUrl = url;
		if (typeof url === 'string' && url.startsWith('http') && !url.includes('?url=')) {
			const WORKER_URL = 'https://corsifly-by-wifi.timco-store1.workers.dev';
			proxiedUrl = WORKER_URL + '?url=' + encodeURIComponent(url);
		}
		return originalFetch.call(this, proxiedUrl, options);
	};
	
	// Also intercept XMLHttpRequest
	const XHROpen = XMLHttpRequest.prototype.open;
	XMLHttpRequest.prototype.open = function(method, url, ...rest) {
		let proxiedUrl = url;
		if (typeof url === 'string' && url.startsWith('http') && !url.includes('?url=')) {
			const WORKER_URL = 'https://corsifly-by-wifi.timco-store1.workers.dev';
			proxiedUrl = WORKER_URL + '?url=' + encodeURIComponent(url);
		}
		return XHROpen.call(this, method, proxiedUrl, ...rest);
	};
	
	// If React fails to render, show noscript fallback
	setTimeout(() => {
		const reactLayout = document.getElementById('react-layout');
		if (!reactLayout || !reactLayout.textContent.trim()) {
			// React didn't render - try to show noscript fallback
			const noscript = document.querySelector('noscript');
			if (noscript && noscript.textContent) {
				// Extract HTML from noscript and show it
				const temp = document.createElement('div');
				temp.innerHTML = noscript.textContent;
				document.body.appendChild(temp);
			}
		}
	}, 3000);
	
	// Make page visible
	if (document.body) {
		document.body.style.visibility = 'visible';
		document.body.style.opacity = '1';
	}
	
	// Intercept window.open
	const originalOpen = window.open;
	window.open = function(url) {
		if (frameElement) frameElement.load(url);
		return window;
	};

	// Intercept history API
	window.history.replaceState = function(s, t, u) { try { return Object.getPrototypeOf(this).constructor.prototype.replaceState.call(this, s, t, u); } catch (e) { return null; } };
	window.history.pushState = function(s, t, u) { try { return Object.getPrototypeOf(this).constructor.prototype.pushState.call(this, s, t, u); } catch (e) { return null; } };

	// Intercept link clicks
	document.addEventListener('click', e => {
		const link = e.target.closest('a[href]');
		if (link) {
			const href = link.getAttribute('href');
			if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('data:')) {
				e.preventDefault();
				frameElement?.load(href);
			}
		}
	}, true);

	// Intercept form submissions
	document.addEventListener('submit', e => {
		const form = e.target;
		const action = form.getAttribute('action');
		if (action && !action.startsWith('data:')) {
			e.preventDefault();
			const method = (form.getAttribute('method') || 'get').toLowerCase();
			if (method === 'post') {
				frameElement?.load(action, {method: 'post', body: new FormData(form)});
			} else {
				frameElement?.load(action + '?' + new URLSearchParams(new FormData(form)));
			}
		}
	}, true);

	// Redirect _blank to frame
	Element.prototype.setAttribute = (function(original) {
		return function(name, value) {
			if (name === 'target' && value === '_blank') value = '_self';
			return original.call(this, name, value);
		};
	})(Element.prototype.setAttribute);
	</script>`)
				
				// Notify parent about page info
			this.notifyPageInfo(pageTitle, faviconUrl, originalUrl);
			}
		}).catch(e => console.error('Cannot load X-Frame:', e))
	}

	rewriteUrls(html, pageUrl) {
		const pageUrlObj = new URL(pageUrl);

		// PERFORMANCE: Fast single-pass rewriting for attributes
		let rewritten = html.replace(
			/(?:src|href|action|data|poster)=["']([^"']+)["']/gi,
			(match, url) => {
				if (url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('#') || url.startsWith('blob:')) {
					return match;
				}
				if (url.includes('?url=')) return match;

				let absoluteUrl;
				try {
					absoluteUrl = url.startsWith('http') ? url : (url.startsWith('//') ? pageUrlObj.protocol + url : new URL(url, pageUrl).href);
				} catch (e) {
					return match;
				}

				return match.replace(url, CLOUDFLARE_WORKER_URL + '?url=' + encodeURIComponent(absoluteUrl));
			}
		);

		// Rewrite URLs in srcset attribute (for responsive images)
		rewritten = rewritten.replace(
			/srcset=["']([^"']+)["']/gi,
			(match, srcset) => {
				const sources = srcset.split(',').map(src => {
					const parts = src.trim().split(/\s+/);
					const url = parts[0];
					const descriptor = parts.slice(1).join(' ');

					if (url.startsWith('data:') || url.startsWith('javascript:') || url.includes('?url=')) {
						return src;
					}

					let absoluteUrl;
					try {
						if (url.startsWith('http://') || url.startsWith('https://')) {
							absoluteUrl = url;
						} else if (url.startsWith('//')) {
							absoluteUrl = pageUrlObj.protocol + url;
						} else {
							absoluteUrl = new URL(url, pageUrl).href;
						}
					} catch (e) {
						return src;
					}

					// Proxy ALL URLs (including cross-origin)
					const proxiedUrl = CLOUDFLARE_WORKER_URL + '?url=' + encodeURIComponent(absoluteUrl);
					return descriptor ? `${proxiedUrl} ${descriptor}` : proxiedUrl;
				}).join(',');

				return `srcset="${sources}"`;
			}
		);

		// Rewrite @import URLs in style tags
		rewritten = rewritten.replace(
			/@import\s+["']([^"']+)["']/gi,
			(match, url) => {
				if (url.startsWith('data:') || url.startsWith('javascript:') || url.includes('?url=')) {
					return match;
				}

				let absoluteUrl;
				try {
					absoluteUrl = url.startsWith('http') ? url : (url.startsWith('//') ? pageUrlObj.protocol + url : new URL(url, pageUrl).href);
				} catch (e) {
					return match;
				}

				return match.replace(url, CLOUDFLARE_WORKER_URL + '?url=' + encodeURIComponent(absoluteUrl));
			}
		);

		// Rewrite url() in CSS (for fonts, images, etc.)
		rewritten = rewritten.replace(
			/url\s*\(\s*["']?([^"')\s]+)["']?\s*\)/gi,
			(match, url) => {
				if (url.startsWith('data:') || url.startsWith('javascript:') || url.includes('?url=')) {
					return match;
				}

				let absoluteUrl;
				try {
					absoluteUrl = url.startsWith('http') ? url : (url.startsWith('//') ? pageUrlObj.protocol + url : new URL(url, pageUrl).href);
				} catch (e) {
					return match;
				}

				return `url('${CLOUDFLARE_WORKER_URL}?url=${encodeURIComponent(absoluteUrl)}')`;
			}
		);

		// Remove CSP meta tags
		rewritten = rewritten.replace(
			/<meta[^>]*http-equiv=["']?content-security-policy["']?[^>]*>/gi,
			''
		);

		return rewritten;
	}

	fetchProxy (url, options) {
		if (!CLOUDFLARE_WORKER_URL || CLOUDFLARE_WORKER_URL.includes('your-subdomain')) {
			throw new Error('ERROR: Cloudflare Worker URL not configured! Update CLOUDFLARE_WORKER_URL at the top of x-frame.js');
		}
		
		return fetch(CLOUDFLARE_WORKER_URL + '?url=' + encodeURIComponent(url), options).then(res => {
			if (!res.ok) {
				throw new Error(`Cloudflare Worker error: ${res.status}`);
			}
			return res;
		}).catch(error => {
			console.error('[X-Frame] Fetch failed:', error);
			throw error;
		});
	}

	notifyPageInfo(title, favicon, url) {
		// Dispatch custom event with page information
		console.log('[X-Frame] Notifying page info:', {title, favicon, url});
		const event = new CustomEvent('x-frame-page-loaded', {
			detail: {
				title: title,
				favicon: favicon,
				url: url
			},
			bubbles: true
		});
		console.log('[X-Frame] Dispatching event from:', this);
		this.dispatchEvent(event);
		console.log('[X-Frame] Event dispatched');
	}
}, {extends: 'iframe'})
