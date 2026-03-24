using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using Path = System.IO.Path;
using Directory = System.IO.Directory;

namespace ACCore;

public class CaptureManager
{
    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    private static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);

    [DllImport("user32.dll")]
    private static extern IntPtr GetDesktopWindow();

    [DllImport("user32.dll")]
    private static extern IntPtr GetWindowDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT { public int Left, Top, Right, Bottom; }

    private readonly string _screenshotDir;

    public CaptureManager(string? screenshotDir = null)
    {
        _screenshotDir = screenshotDir ?? Path.Combine(Path.GetTempPath(), "ac");
        Directory.CreateDirectory(_screenshotDir);
    }

    public object CaptureWindow(IntPtr? windowHandle, string? outputPath = null, string format = "png", int quality = 90)
    {
        var path = outputPath ?? GeneratePath(format);

        Bitmap bitmap;
        if (windowHandle != null)
        {
            GetWindowRect(windowHandle.Value, out RECT rect);
            int width = rect.Right - rect.Left;
            int height = rect.Bottom - rect.Top;

            if (width <= 0 || height <= 0)
                throw new ACException(ErrorCodes.WindowNotFound, "Window has no visible area");

            bitmap = new Bitmap(width, height);
            using var g = Graphics.FromImage(bitmap);
            var hdc = g.GetHdc();
            PrintWindow(windowHandle.Value, hdc, 2); // PW_RENDERFULLCONTENT
            g.ReleaseHdc(hdc);
        }
        else
        {
            // Full screen capture
            var screen = System.Windows.Forms.Screen.PrimaryScreen!;
            bitmap = new Bitmap(screen.Bounds.Width, screen.Bounds.Height);
            using var g = Graphics.FromImage(bitmap);
            g.CopyFromScreen(screen.Bounds.Location, Point.Empty, screen.Bounds.Size);
        }

        try
        {
            var imageFormat = format.ToLowerInvariant() switch
            {
                "jpg" or "jpeg" => ImageFormat.Jpeg,
                _ => ImageFormat.Png,
            };

            if (imageFormat == ImageFormat.Jpeg)
            {
                var encoder = ImageCodecInfo.GetImageEncoders().First(e => e.FormatID == ImageFormat.Jpeg.Guid);
                var encoderParams = new EncoderParameters(1);
                encoderParams.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, quality);
                bitmap.Save(path, encoder, encoderParams);
            }
            else
            {
                bitmap.Save(path, imageFormat);
            }

            return new { ok = true, path, width = bitmap.Width, height = bitmap.Height };
        }
        finally
        {
            bitmap.Dispose();
        }
    }

    public object CaptureScreen(string? outputPath = null, string format = "png", int quality = 90)
    {
        return CaptureWindow(null, outputPath, format, quality);
    }

    public object ListDisplays()
    {
        var displays = new List<object>();
        int id = 0;
        foreach (var screen in System.Windows.Forms.Screen.AllScreens)
        {
            displays.Add(new
            {
                id = id++,
                width = screen.Bounds.Width,
                height = screen.Bounds.Height,
                x = screen.Bounds.X,
                y = screen.Bounds.Y,
                is_main = screen.Primary,
                scale_factor = GetScaleFactor(screen),
            });
        }
        return new { displays };
    }

    private string GeneratePath(string format)
    {
        var timestamp = DateTime.Now.ToString("yyyyMMdd-HHmmss-fff");
        return Path.Combine(_screenshotDir, $"ac-{timestamp}.{format}");
    }

    private static double GetScaleFactor(System.Windows.Forms.Screen screen)
    {
        // Approximate DPI scale factor
        try
        {
            using var g = Graphics.FromHwnd(IntPtr.Zero);
            return g.DpiX / 96.0;
        }
        catch
        {
            return 1.0;
        }
    }
}
