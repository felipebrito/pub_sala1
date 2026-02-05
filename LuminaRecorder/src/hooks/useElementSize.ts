import { useState, useLayoutEffect, useCallback } from 'react';

export function useElementSize() {
    const [element, setElement] = useState<HTMLDivElement | null>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    const ref = useCallback((node: HTMLDivElement | null) => {
        setElement(node);
    }, []);

    useLayoutEffect(() => {
        if (!element) return;

        const updateSize = () => {
            const rect = element.getBoundingClientRect();
            setSize({ width: rect.width, height: rect.height });
        };

        updateSize();

        const observer = new ResizeObserver(updateSize);
        observer.observe(element);

        return () => observer.disconnect();
    }, [element]);

    return { ref, element, width: size.width, height: size.height };
}
