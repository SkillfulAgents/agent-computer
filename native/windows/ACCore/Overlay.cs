using System.Collections.Concurrent;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace ACCore;

/// <summary>
/// Animated halo overlay around the grabbed window.
/// Uses UpdateLayeredWindow with per-pixel alpha for smooth glow effect.
/// Z-order tracks just above the target window (not always-on-top).
/// Uses GetWindowRect with shadow compensation for accurate visible bounds.
/// </summary>
public class HaloOverlay : IDisposable
{
    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    private static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    private static extern bool UpdateLayeredWindow(IntPtr hWnd, IntPtr hdcDst,
        ref POINT pptDst, ref SIZE psize, IntPtr hdcSrc, ref POINT pptSrc,
        uint crKey, ref BLENDFUNCTION pblend, uint dwFlags);

    [DllImport("user32.dll")]
    private static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("user32.dll")]
    private static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);

    [DllImport("gdi32.dll")]
    private static extern IntPtr CreateCompatibleDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    private static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport("gdi32.dll")]
    private static extern bool DeleteDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    private static extern bool DeleteObject(IntPtr hObject);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT { public int X, Y; }

    [StructLayout(LayoutKind.Sequential)]
    private struct SIZE { public int Width, Height; }

    [StructLayout(LayoutKind.Sequential)]
    private struct BLENDFUNCTION
    {
        public byte BlendOp;
        public byte BlendFlags;
        public byte SourceConstantAlpha;
        public byte AlphaFormat;
    }

    private const int WS_EX_LAYERED = 0x80000;
    private const int WS_EX_TRANSPARENT = 0x20;
    private const int WS_EX_TOOLWINDOW = 0x80;
    private const int WS_EX_NOACTIVATE = 0x08000000;
    private const uint SWP_NOACTIVATE = 0x10;
    private const uint SWP_NOSENDCHANGING = 0x0400;
    private const uint ULW_ALPHA = 0x02;
    private const byte AC_SRC_OVER = 0x00;
    private const byte AC_SRC_ALPHA = 0x01;
    private const uint GW_HWNDPREV = 3;

    private const int GlowRadius = 24;
    private const float BorderWidth = 3.5f;

    private IntPtr _targetHandle;
    private OverlayWindow? _overlayWindow;
    private System.Threading.Timer? _animTimer;
    private RECT _lastTargetRect;
    private bool _disposed;
    private float _animPhase;

    public void Show(IntPtr targetHandle)
    {
        _targetHandle = targetHandle;
        if (!IsWindow(targetHandle)) return;

        var thread = new Thread(() =>
        {
            OverlayWindow window;
            try { window = new OverlayWindow(); }
            catch { return; }
            _overlayWindow = window;
            UpdatePositionAndRender();

            _animTimer = new System.Threading.Timer(_ =>
            {
                try
                {
                    if (_overlayWindow == null || _overlayWindow.IsDisposed) return;
                    if (!IsWindow(_targetHandle)) { Remove(); return; }

                    _animPhase += 0.06f;
                    _overlayWindow.Invoke(UpdatePositionAndRender);
                }
                catch { }
            }, null, 0, 33);

            window.RunMessageLoop();
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.IsBackground = true;
        thread.Start();
    }

    public void Remove()
    {
        _animTimer?.Dispose();
        _animTimer = null;
        try
        {
            var window = _overlayWindow;
            if (window != null && !window.IsDisposed)
                window.Invoke(window.Close);
        }
        catch { }
        _overlayWindow = null;
    }

    private void UpdatePositionAndRender()
    {
        var window = _overlayWindow;
        if (window == null || window.IsDisposed || !IsWindow(_targetHandle)) return;

        GetWindowRect(_targetHandle, out RECT rawRect);

        // Windows 10/11 adds an invisible shadow around windows.
        // Inset the rect to get the actual visible window bounds.
        const int shadowLeft = 6;
        const int shadowRight = 7;
        const int shadowBottom = 7;
        const int shadowTop = 0;
        var targetRect = new RECT
        {
            Left = rawRect.Left + shadowLeft,
            Top = rawRect.Top + shadowTop,
            Right = rawRect.Right - shadowRight,
            Bottom = rawRect.Bottom - shadowBottom,
        };

        int tw = targetRect.Right - targetRect.Left;
        int th = targetRect.Bottom - targetRect.Top;
        if (tw <= 0 || th <= 0) return;

        int pad = GlowRadius + 1;
        int ox = targetRect.Left - pad;
        int oy = targetRect.Top - pad;
        int ow = tw + pad * 2;
        int oh = th + pad * 2;

        bool posChanged = targetRect.Left != _lastTargetRect.Left ||
                          targetRect.Top != _lastTargetRect.Top ||
                          targetRect.Right != _lastTargetRect.Right ||
                          targetRect.Bottom != _lastTargetRect.Bottom;
        _lastTargetRect = targetRect;

        // Render the glow bitmap
        using var bmp = new Bitmap(ow, oh, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Color.Transparent);

            // Animate color: blue (#4285F4) ↔ purple (#8C50DC)
            float t = (float)(Math.Sin(_animPhase) * 0.5 + 0.5);
            int cr = (int)(66 + t * (140 - 66));
            int cg = (int)(133 + t * (80 - 133));
            int cb = (int)(244 + t * (220 - 244));

            float pulse = 0.7f + 0.3f * (float)Math.Sin(_animPhase * 1.3);

            // Glow: concentric rounded rects, alpha fading outward
            var innerRect = new RectangleF(pad, pad, tw, th);
            float cornerRadius = 8f;

            for (int i = GlowRadius; i >= 1; i--)
            {
                float frac = i / (float)GlowRadius;
                float alpha = pulse * 0.18f * (1f - frac * frac); // Quadratic falloff, brighter overall
                int a = Math.Clamp((int)(alpha * 255), 1, 255);

                var glowRect = RectangleF.Inflate(innerRect, i, i);
                float cr2 = cornerRadius + i;
                using var pen = new Pen(Color.FromArgb(a, cr, cg, cb), 2f);
                DrawRoundedRect(g, pen, glowRect, cr2);
            }

            // Solid border
            int borderAlpha = (int)(pulse * 200);
            using var borderPen = new Pen(Color.FromArgb(borderAlpha, cr, cg, cb), BorderWidth);
            DrawRoundedRect(g, borderPen, innerRect, cornerRadius);

            // Inner highlight
            int hlAlpha = (int)(pulse * 80);
            using var hlPen = new Pen(Color.FromArgb(hlAlpha,
                Math.Min(cr + 60, 255), Math.Min(cg + 40, 255), Math.Min(cb + 20, 255)), 1f);
            DrawRoundedRect(g, hlPen, RectangleF.Inflate(innerRect, -1f, -1f), cornerRadius - 1f);
        }

        ApplyBitmap(bmp, ox, oy, ow, oh);

        // Z-order: place overlay just above the target window (not TOPMOST)
        // GetWindow(target, GW_HWNDPREV) returns the window above target;
        // inserting overlay after that window places it between that window and target.
        IntPtr insertAfter = GetWindow(_targetHandle, GW_HWNDPREV);
        if (insertAfter == IntPtr.Zero || insertAfter == window.Handle)
        {
            // Target is the topmost window — just use HWND_TOP (not TOPMOST)
            insertAfter = IntPtr.Zero; // HWND_TOP
        }

        SetWindowPos(window.Handle, insertAfter, ox, oy, ow, oh,
            SWP_NOACTIVATE | SWP_NOSENDCHANGING);
    }

    private void ApplyBitmap(Bitmap bmp, int x, int y, int w, int h)
    {
        var window = _overlayWindow;
        if (window == null) return;

        IntPtr screenDC = IntPtr.Zero;
        IntPtr memDC = IntPtr.Zero;
        IntPtr hBitmap = IntPtr.Zero;
        IntPtr oldBitmap = IntPtr.Zero;

        try
        {
            screenDC = GetDC(IntPtr.Zero);
            memDC = CreateCompatibleDC(screenDC);
            hBitmap = bmp.GetHbitmap(Color.FromArgb(0));
            oldBitmap = SelectObject(memDC, hBitmap);

            var ptDst = new POINT { X = x, Y = y };
            var size = new SIZE { Width = w, Height = h };
            var ptSrc = new POINT { X = 0, Y = 0 };
            var blend = new BLENDFUNCTION
            {
                BlendOp = AC_SRC_OVER,
                BlendFlags = 0,
                SourceConstantAlpha = 255,
                AlphaFormat = AC_SRC_ALPHA,
            };

            UpdateLayeredWindow(window.Handle, screenDC, ref ptDst, ref size, memDC, ref ptSrc, 0, ref blend, ULW_ALPHA);
        }
        finally
        {
            if (oldBitmap != IntPtr.Zero && memDC != IntPtr.Zero)
                SelectObject(memDC, oldBitmap);
            if (hBitmap != IntPtr.Zero)
                DeleteObject(hBitmap);
            if (memDC != IntPtr.Zero)
                DeleteDC(memDC);
            if (screenDC != IntPtr.Zero)
                ReleaseDC(IntPtr.Zero, screenDC);
        }
    }

    private static void DrawRoundedRect(Graphics g, Pen pen, RectangleF rect, float radius)
    {
        if (rect.Width <= 0 || rect.Height <= 0) return;
        radius = Math.Min(radius, Math.Min(rect.Width, rect.Height) / 2f);

        using var path = new GraphicsPath();
        float d = radius * 2;
        path.AddArc(rect.X, rect.Y, d, d, 180, 90);
        path.AddArc(rect.Right - d, rect.Y, d, d, 270, 90);
        path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0, 90);
        path.AddArc(rect.X, rect.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        g.DrawPath(pen, path);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        Remove();
    }

    /// <summary>
    /// A bare Win32 layered, click-through, non-activating tool window with its
    /// own message loop. Replaces the WinForms Form so the daemon does not have
    /// to ship the WinForms runtime. Content is painted via UpdateLayeredWindow.
    /// </summary>
    private sealed class OverlayWindow
    {
        private const int WS_POPUP = unchecked((int)0x80000000);
        private const int SW_SHOWNOACTIVATE = 4;
        private const uint WM_DESTROY = 0x0002;
        private const uint WM_APP_INVOKE = 0x8000 + 1; // WM_APP + 1
        private const string ClassName = "ACCoreHaloOverlay";

        private delegate IntPtr WndProcDelegate(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct WNDCLASSEX
        {
            public int cbSize;
            public uint style;
            public WndProcDelegate lpfnWndProc;
            public int cbClsExtra;
            public int cbWndExtra;
            public IntPtr hInstance;
            public IntPtr hIcon;
            public IntPtr hCursor;
            public IntPtr hbrBackground;
            public string? lpszMenuName;
            public string lpszClassName;
            public IntPtr hIconSm;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MSG
        {
            public IntPtr hwnd;
            public uint message;
            public IntPtr wParam;
            public IntPtr lParam;
            public uint time;
            public POINT pt;
        }

        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern ushort RegisterClassEx(ref WNDCLASSEX lpwcx);

        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern IntPtr CreateWindowEx(int dwExStyle, string lpClassName, string lpWindowName,
            int dwStyle, int x, int y, int nWidth, int nHeight, IntPtr hWndParent, IntPtr hMenu,
            IntPtr hInstance, IntPtr lpParam);

        [DllImport("user32.dll")]
        private static extern IntPtr DefWindowProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool DestroyWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        private static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

        [DllImport("user32.dll")]
        private static extern bool TranslateMessage(ref MSG lpMsg);

        [DllImport("user32.dll")]
        private static extern IntPtr DispatchMessage(ref MSG lpMsg);

        [DllImport("user32.dll")]
        private static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern void PostQuitMessage(int nExitCode);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr GetModuleHandle(string? lpModuleName);

        // The delegate must outlive the window class registration.
        private static readonly WndProcDelegate s_wndProc = StaticWndProc;
        private static ushort s_classAtom;
        private static readonly object s_classLock = new();
        private static readonly Dictionary<IntPtr, OverlayWindow> s_windows = new();

        private readonly ConcurrentQueue<Action> _pending = new();
        private readonly int _threadId = Environment.CurrentManagedThreadId;

        public IntPtr Handle { get; }
        public bool IsDisposed { get; private set; }

        public OverlayWindow()
        {
            EnsureClassRegistered();
            Handle = CreateWindowEx(
                WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
                ClassName, string.Empty, WS_POPUP, -100, -100, 1, 1,
                IntPtr.Zero, IntPtr.Zero, GetModuleHandle(null), IntPtr.Zero);
            if (Handle == IntPtr.Zero)
                throw new InvalidOperationException("CreateWindowEx failed: " + Marshal.GetLastWin32Error());
            lock (s_windows) s_windows[Handle] = this;
            ShowWindow(Handle, SW_SHOWNOACTIVATE);
        }

        /// <summary>Run <paramref name="action"/> on the window's thread and wait (bounded) for it.</summary>
        public void Invoke(Action action)
        {
            if (IsDisposed) return;
            if (Environment.CurrentManagedThreadId == _threadId) { action(); return; }
            using var done = new ManualResetEventSlim(false);
            _pending.Enqueue(() => { try { action(); } finally { done.Set(); } });
            if (!PostMessage(Handle, WM_APP_INVOKE, IntPtr.Zero, IntPtr.Zero)) return;
            done.Wait(2000);
        }

        public void Close()
        {
            if (IsDisposed) return;
            DestroyWindow(Handle);
        }

        public void RunMessageLoop()
        {
            while (GetMessage(out var msg, IntPtr.Zero, 0, 0) > 0)
            {
                TranslateMessage(ref msg);
                DispatchMessage(ref msg);
            }
        }

        private static void EnsureClassRegistered()
        {
            lock (s_classLock)
            {
                if (s_classAtom != 0) return;
                var wc = new WNDCLASSEX
                {
                    cbSize = Marshal.SizeOf<WNDCLASSEX>(),
                    lpfnWndProc = s_wndProc,
                    hInstance = GetModuleHandle(null),
                    lpszClassName = ClassName,
                };
                s_classAtom = RegisterClassEx(ref wc);
                if (s_classAtom == 0)
                    throw new InvalidOperationException("RegisterClassEx failed: " + Marshal.GetLastWin32Error());
            }
        }

        private static IntPtr StaticWndProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam)
        {
            OverlayWindow? self;
            lock (s_windows) s_windows.TryGetValue(hWnd, out self);

            switch (msg)
            {
                case WM_APP_INVOKE:
                    while (self != null && self._pending.TryDequeue(out var action))
                    {
                        try { action(); } catch { }
                    }
                    return IntPtr.Zero;

                case WM_DESTROY:
                    if (self != null)
                    {
                        self.IsDisposed = true;
                        lock (s_windows) s_windows.Remove(hWnd);
                        // Release anything still parked in Invoke().
                        while (self._pending.TryDequeue(out var action))
                        {
                            try { action(); } catch { }
                        }
                    }
                    PostQuitMessage(0);
                    return IntPtr.Zero;
            }
            return DefWindowProc(hWnd, msg, wParam, lParam);
        }
    }
}
