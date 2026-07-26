/**
 * Entrance reveals for slide content. The hidden state is applied by JS only
 * (`reveal` class added here), so guests without JS always see content, and
 * `prefers-reduced-motion` guests never see movement (spec §3.1 progressive
 * enhancement).
 */
export function inview(node: HTMLElement) {
	if (typeof IntersectionObserver === 'undefined') return {};
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return {};
	node.classList.add('reveal');
	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					node.classList.add('in-view');
					io.unobserve(node);
				}
			}
		},
		{ threshold: 0.3 }
	);
	io.observe(node);
	return {
		destroy() {
			io.disconnect();
		}
	};
}
