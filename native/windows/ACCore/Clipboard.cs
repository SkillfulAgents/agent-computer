using System.Runtime.InteropServices;

namespace ACCore;

/// <summary>
/// Unicode-text clipboard access over the raw Win32 clipboard API. The
/// clipboard can be briefly owned by another process, so open is retried.
/// </summary>
public class Clipboard
{
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool OpenClipboard(IntPtr hWndNewOwner);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool CloseClipboard();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool EmptyClipboard();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr GetClipboardData(uint uFormat);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetClipboardData(uint uFormat, IntPtr hMem);

    [DllImport("user32.dll")]
    private static extern bool IsClipboardFormatAvailable(uint format);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GlobalLock(IntPtr hMem);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GlobalUnlock(IntPtr hMem);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GlobalAlloc(uint uFlags, UIntPtr dwBytes);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GlobalFree(IntPtr hMem);

    private const uint CF_UNICODETEXT = 13;
    private const uint GMEM_MOVEABLE = 0x0002;
    private const int OpenAttempts = 10;

    public string? Read()
    {
        if (!IsClipboardFormatAvailable(CF_UNICODETEXT)) return null;
        OpenWithRetry();
        try
        {
            var hData = GetClipboardData(CF_UNICODETEXT);
            if (hData == IntPtr.Zero) return null;
            var ptr = GlobalLock(hData);
            if (ptr == IntPtr.Zero) return null;
            try { return Marshal.PtrToStringUni(ptr); }
            finally { GlobalUnlock(hData); }
        }
        finally { CloseClipboard(); }
    }

    public void Set(string text)
    {
        var bytes = (text.Length + 1) * 2;
        var hMem = GlobalAlloc(GMEM_MOVEABLE, (UIntPtr)bytes);
        if (hMem == IntPtr.Zero) throw new ACException(ErrorCodes.InternalError, "GlobalAlloc failed");
        var ptr = GlobalLock(hMem);
        if (ptr == IntPtr.Zero)
        {
            GlobalFree(hMem);
            throw new ACException(ErrorCodes.InternalError, "GlobalLock failed");
        }
        try
        {
            Marshal.Copy(text.ToCharArray(), 0, ptr, text.Length);
            Marshal.WriteInt16(ptr, text.Length * 2, 0);
        }
        finally { GlobalUnlock(hMem); }

        OpenWithRetry();
        try
        {
            EmptyClipboard();
            if (SetClipboardData(CF_UNICODETEXT, hMem) == IntPtr.Zero)
            {
                GlobalFree(hMem); // ownership was not transferred
                throw new ACException(ErrorCodes.InternalError, "SetClipboardData failed");
            }
            // On success the system owns hMem.
        }
        finally { CloseClipboard(); }
    }

    private static void OpenWithRetry()
    {
        for (int i = 0; i < OpenAttempts; i++)
        {
            if (OpenClipboard(IntPtr.Zero)) return;
            Thread.Sleep(20);
        }
        throw new ACException(ErrorCodes.InternalError, "Clipboard is busy");
    }
}
