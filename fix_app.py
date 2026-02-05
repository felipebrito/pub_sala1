import os

target = """    const undo = useCallback(() => {
        if (history.length === 0) return;
        setHistory(prev => {
            const [last, ...remaining] = prev;
            setProjectors(last);

            // Update renderer for all
            last.forEach((proj, i) => {
                rendererRef.current?.updateGridWarp(i, proj.grid, proj.rows, proj.cols, proj.mode);
                rendererRef.current?.updateInputCrop(i, proj.crop);
                rendererRef.current?.updateEdgeBlend(i, proj.edgeBlend);
            });

            localStorage.setItem('lumina-config-v4', JSON.stringify(last));
            return remaining;
        });
    }, [history]);

    const fullReset = () => {
        pushHistory();
        const rows = 2, cols = 2;
        const defaultGrid = createDefaultGrid(rows, cols);
        const resetCrop = { x: 0, y: 0, width: 1, height: 1 };

        setProjectors(prev => {
            const next = [...prev];
            next[selectedProjector] = {
                ...next[selectedProjector],
                rows,
                cols,
                grid: defaultGrid,
                mode: 'linear',
                crop: resetCrop
            };
            localStorage.setItem('lumina-config-v4', JSON.stringify(next));
            return next;
        });

        if (rendererRef.current) {
            rendererRef.current.updateGridWarp(selectedProjector, defaultGrid, rows, cols, 'linear');
            rendererRef.current.updateInputCrop(selectedProjector, resetCrop);
        }
        setSelectedPoints([]);
    };"""

replacement = """    const undo = useCallback(() => {
        setHistory(prev => {
            if (prev.length === 0) return prev;
            const [last, ...remaining] = prev;
            setProjectors(last);

            // Update renderer for all
            last.forEach((proj, i) => {
                rendererRef.current?.updateGridWarp(i, proj.grid, proj.rows, proj.cols, proj.mode);
                rendererRef.current?.updateInputCrop(i, proj.crop);
                rendererRef.current?.updateEdgeBlend(i, proj.edgeBlend);
            });

            localStorage.setItem('lumina-config-v4', JSON.stringify(last));
            return remaining;
        });
    }, []);

    const fullReset = () => {
        pushHistory();
        const rows = 2, cols = 2;
        const defaultGrid = createDefaultGrid(rows, cols);

        setProjectors(prev => {
            const next = [...prev];
            next[selectedProjector] = {
                ...next[selectedProjector],
                rows,
                cols,
                grid: defaultGrid,
                mode: 'linear'
            };
            localStorage.setItem('lumina-config-v4', JSON.stringify(next));
            return next;
        });

        if (rendererRef.current) {
            rendererRef.current.updateGridWarp(selectedProjector, defaultGrid, rows, cols, 'linear');
        }
        setSelectedPoints([]);
    };"""

path = 'src/App.tsx'
with open(path, 'r') as f:
    content = f.read()

if target in content:
    new_content = content.replace(target, replacement)
    with open(path, 'w') as f:
        f.write(new_content)
    print("SUCCESS")
else:
    print("TARGET NOT FOUND")
    # Debug print to show diff
    print("Start of file content showing target area:")
    start_idx = content.find("const undo = useCallback")
    if start_idx != -1:
         print(repr(content[start_idx:start_idx+500]))
    else:
         print("Could not even find start of undo")

