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

    [DllImport("user32.dll")]
    private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

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

    private const int GWL_EXSTYLE = -20;
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
    private System.Windows.Forms.Form? _overlayForm;
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
            _overlayForm = new GlowForm();
            UpdatePositionAndRender();

            _animTimer = new System.Threading.Timer(_ =>
            {
                try
                {
                    if (_overlayForm == null || _overlayForm.IsDisposed) return;
                    if (!IsWindow(_targetHandle)) { Remove(); return; }

                    _animPhase += 0.06f;
                    _overlayForm.Invoke(new Action(UpdatePositionAndRender));
                }
                catch { }
            }, null, 0, 33);

            System.Windows.Forms.Application.Run(_overlayForm);
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
            if (_overlayForm != null && !_overlayForm.IsDisposed)
                _overlayForm.Invoke(new Action(() =>
                {
                    _overlayForm.Close();
                    System.Windows.Forms.Application.ExitThread();
                }));
        }
        catch { }
        _overlayForm = null;
    }

    private void UpdatePositionAndRender()
    {
        if (_overlayForm == null || _overlayForm.IsDisposed || !IsWindow(_targetHandle)) return;

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
        if (insertAfter == IntPtr.Zero || insertAfter == _overlayForm.Handle)
        {
            // Target is the topmost window — just use HWND_TOP (not TOPMOST)
            insertAfter = IntPtr.Zero; // HWND_TOP
        }

        SetWindowPos(_overlayForm.Handle, insertAfter, ox, oy, ow, oh,
            SWP_NOACTIVATE | SWP_NOSENDCHANGING);
    }

    private void ApplyBitmap(Bitmap bmp, int x, int y, int w, int h)
    {
        if (_overlayForm == null) return;

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

            UpdateLayeredWindow(_overlayForm.Handle, screenDC, ref ptDst, ref size, memDC, ref ptSrc, 0, ref blend, ULW_ALPHA);
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

    private class GlowForm : System.Windows.Forms.Form
    {
        public GlowForm()
        {
            FormBorderStyle = System.Windows.Forms.FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = System.Windows.Forms.FormStartPosition.Manual;
            Size = new Size(1, 1);
            Location = new System.Drawing.Point(-100, -100);
        }

        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                cp.ExStyle |= WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
                return cp;
            }
        }

        protected override void OnPaintBackground(System.Windows.Forms.PaintEventArgs e) { }
        protected override void OnPaint(System.Windows.Forms.PaintEventArgs e) { }
    }
}
