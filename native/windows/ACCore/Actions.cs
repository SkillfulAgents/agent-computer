using System.Runtime.InteropServices;
using System.Windows.Automation;

namespace ACCore;

public class Actions
{
    [DllImport("user32.dll")]
    private static extern void SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    private static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, IntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    private static extern bool GetCursorPos(out POINT lpPoint);

    private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    private const uint MOUSEEVENTF_LEFTUP = 0x0004;
    private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    private const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    private const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    private const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    private const uint MOUSEEVENTF_WHEEL = 0x0800;
    private const uint MOUSEEVENTF_HWHEEL = 0x1000;
    private const uint MOUSEEVENTF_ABSOLUTE = 0x8000;
    private const uint MOUSEEVENTF_MOVE = 0x0001;

    private const uint INPUT_MOUSE = 0;
    private const uint INPUT_KEYBOARD = 1;

    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const uint KEYEVENTF_UNICODE = 0x0004;
    private const uint KEYEVENTF_EXTENDEDKEY = 0x0001;

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT { public int X, Y; }

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT
    {
        public uint type;
        public InputUnion U;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct InputUnion
    {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT
    {
        public int dx, dy;
        public int mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    private readonly Dictionary<string, AutomationElement> _refMap;

    public Actions(Dictionary<string, AutomationElement> refMap)
    {
        _refMap = refMap;
    }

    public void Click(string? refStr, int? x = null, int? y = null,
        bool right = false, bool doubleClick = false, int count = 1, string[]? modifiers = null)
    {
        int cx, cy;

        if (x.HasValue && y.HasValue)
        {
            cx = x.Value;
            cy = y.Value;
        }
        else if (refStr != null)
        {
            // Try UIA InvokePattern first for simple left clicks
            if (!right && !doubleClick && count == 1 && (modifiers == null || modifiers.Length == 0))
            {
                var element = ResolveElement(refStr);
                if (element.TryGetCurrentPattern(InvokePattern.Pattern, out var invokeObj))
                {
                    ((InvokePattern)invokeObj).Invoke();
                    return;
                }
            }

            var bounds = GetElementCenter(refStr);
            cx = bounds.x;
            cy = bounds.y;
        }
        else
        {
            throw new ACException(ErrorCodes.InvalidParams, "Click requires a ref or x,y coordinates");
        }

        // Hold modifiers
        if (modifiers != null)
        {
            foreach (var mod in modifiers) HoldModifier(mod, true);
        }

        SetCursorPos(cx, cy);
        Thread.Sleep(10);

        uint downFlag = right ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_LEFTDOWN;
        uint upFlag = right ? MOUSEEVENTF_RIGHTUP : MOUSEEVENTF_LEFTUP;

        int totalClicks = doubleClick ? 2 : count;
        for (int i = 0; i < totalClicks; i++)
        {
            mouse_event(downFlag, 0, 0, 0, IntPtr.Zero);
            Thread.Sleep(10);
            mouse_event(upFlag, 0, 0, 0, IntPtr.Zero);
            if (i < totalClicks - 1) Thread.Sleep(50);
        }

        // Release modifiers
        if (modifiers != null)
        {
            foreach (var mod in modifiers) HoldModifier(mod, false);
        }
    }

    public void Hover(string? refStr, int? x = null, int? y = null)
    {
        int cx, cy;
        if (x.HasValue && y.HasValue)
        {
            cx = x.Value;
            cy = y.Value;
        }
        else if (refStr != null)
        {
            var center = GetElementCenter(refStr);
            cx = center.x;
            cy = center.y;
        }
        else
        {
            throw new ACException(ErrorCodes.InvalidParams, "Hover requires a ref or x,y coordinates");
        }

        SetCursorPos(cx, cy);
    }

    public void MouseButton(string action, string button = "left")
    {
        uint flag = (action, button) switch
        {
            ("down", "left") => MOUSEEVENTF_LEFTDOWN,
            ("up", "left") => MOUSEEVENTF_LEFTUP,
            ("down", "right") => MOUSEEVENTF_RIGHTDOWN,
            ("up", "right") => MOUSEEVENTF_RIGHTUP,
            ("down", "middle") => MOUSEEVENTF_MIDDLEDOWN,
            ("up", "middle") => MOUSEEVENTF_MIDDLEUP,
            _ => throw new ACException(ErrorCodes.InvalidParams, $"Invalid mouse action: {action} {button}")
        };

        mouse_event(flag, 0, 0, 0, IntPtr.Zero);
    }

    public void Focus(string refStr)
    {
        var element = ResolveElement(refStr);
        try
        {
            element.SetFocus();
        }
        catch
        {
            // Fallback: click the element
            var center = GetElementCenter(refStr);
            SetCursorPos(center.x, center.y);
            Thread.Sleep(10);
            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, IntPtr.Zero);
            Thread.Sleep(10);
            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, IntPtr.Zero);
        }
    }

    public void Fill(string refStr, string text)
    {
        var element = ResolveElement(refStr);

        // Try ValuePattern first
        if (element.TryGetCurrentPattern(ValuePattern.Pattern, out var valObj))
        {
            var valPattern = (ValuePattern)valObj;
            if (!valPattern.Current.IsReadOnly)
            {
                valPattern.SetValue(text);
                return;
            }
        }

        // Fallback: focus, select all, type
        Focus(refStr);
        Thread.Sleep(50);
        PressKey("ctrl+a");
        Thread.Sleep(50);
        TypeText(text);
    }

    public void Select(string refStr, string value)
    {
        var element = ResolveElement(refStr);

        // Try ValuePattern
        if (element.TryGetCurrentPattern(ValuePattern.Pattern, out var valObj))
        {
            ((ValuePattern)valObj).SetValue(value);
            return;
        }

        // Try expanding and finding the item
        if (element.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out var expandObj))
        {
            var expand = (ExpandCollapsePattern)expandObj;
            expand.Expand();
            Thread.Sleep(200);

            // Find child matching value
            var walker = TreeWalker.ControlViewWalker;
            var child = walker.GetFirstChild(element);
            while (child != null)
            {
                if (child.Current.Name.Equals(value, StringComparison.OrdinalIgnoreCase))
                {
                    if (child.TryGetCurrentPattern(SelectionItemPattern.Pattern, out var selObj))
                    {
                        ((SelectionItemPattern)selObj).Select();
                        return;
                    }
                    if (child.TryGetCurrentPattern(InvokePattern.Pattern, out var invObj))
                    {
                        ((InvokePattern)invObj).Invoke();
                        return;
                    }
                }
                child = walker.GetNextSibling(child);
            }

            expand.Collapse();
        }

        throw new ACException(ErrorCodes.ElementNotFound, $"Could not select value: {value}");
    }

    public void Check(string refStr)
    {
        var element = ResolveElement(refStr);
        if (element.TryGetCurrentPattern(TogglePattern.Pattern, out var toggleObj))
        {
            var toggle = (TogglePattern)toggleObj;
            if (toggle.Current.ToggleState != ToggleState.On)
                toggle.Toggle();
            return;
        }
        throw new ACException(ErrorCodes.InvalidParams, "Element does not support check/uncheck");
    }

    public void Uncheck(string refStr)
    {
        var element = ResolveElement(refStr);
        if (element.TryGetCurrentPattern(TogglePattern.Pattern, out var toggleObj))
        {
            var toggle = (TogglePattern)toggleObj;
            if (toggle.Current.ToggleState != ToggleState.Off)
                toggle.Toggle();
            return;
        }
        throw new ACException(ErrorCodes.InvalidParams, "Element does not support check/uncheck");
    }

    public void SetValue(string refStr, string value)
    {
        var element = ResolveElement(refStr);

        // Try RangeValuePattern (sliders, steppers)
        if (element.TryGetCurrentPattern(RangeValuePattern.Pattern, out var rangeObj))
        {
            if (double.TryParse(value, out var numVal))
            {
                ((RangeValuePattern)rangeObj).SetValue(numVal);
                return;
            }
        }

        // Try ValuePattern
        if (element.TryGetCurrentPattern(ValuePattern.Pattern, out var valObj))
        {
            ((ValuePattern)valObj).SetValue(value);
            return;
        }

        throw new ACException(ErrorCodes.InvalidParams, "Element does not support set value");
    }

    private AutomationElement ResolveElement(string refStr)
    {
        if (_refMap.TryGetValue(refStr, out var element))
            return element;
        throw new ACException(ErrorCodes.ElementNotFound, $"Element not found: {refStr}",
            new { available_refs = _refMap.Keys.Take(20).ToArray() });
    }

    private (int x, int y) GetElementCenter(string refStr)
    {
        var element = ResolveElement(refStr);
        var rect = element.Current.BoundingRectangle;
        if (rect.IsEmpty)
            throw new ACException(ErrorCodes.ElementNotFound, $"Element has no bounds: {refStr}");
        return ((int)(rect.X + rect.Width / 2), (int)(rect.Y + rect.Height / 2));
    }

    // --- Keyboard ---

    public void TypeText(string text, int delayMs = 0)
    {
        foreach (char c in text)
        {
            SendUnicodeChar(c);
            if (delayMs > 0) Thread.Sleep(delayMs);
        }
    }

    public void PressKey(string combo, int repeat = 1)
    {
        var parts = combo.ToLowerInvariant().Split('+');
        var modifiers = new List<ushort>();
        ushort? mainKey = null;

        foreach (var part in parts)
        {
            var trimmed = part.Trim();
            if (IsModifier(trimmed))
                modifiers.Add(VirtualKeyFromName(trimmed));
            else
                mainKey = VirtualKeyFromName(trimmed);
        }

        for (int i = 0; i < repeat; i++)
        {
            // Press modifiers
            foreach (var mod in modifiers)
                SendKeyEvent(mod, false);

            // Press and release main key
            if (mainKey.HasValue)
            {
                SendKeyEvent(mainKey.Value, false);
                SendKeyEvent(mainKey.Value, true);
            }

            // Release modifiers in reverse
            for (int m = modifiers.Count - 1; m >= 0; m--)
                SendKeyEvent(modifiers[m], true);

            if (i < repeat - 1) Thread.Sleep(30);
        }
    }

    public void KeyDown(string key)
    {
        var vk = VirtualKeyFromName(key.ToLowerInvariant());
        SendKeyEvent(vk, false);
    }

    public void KeyUp(string key)
    {
        var vk = VirtualKeyFromName(key.ToLowerInvariant());
        SendKeyEvent(vk, true);
    }

    public void Paste(string text, Clipboard clipboard)
    {
        // Save current clipboard
        var saved = clipboard.Read();

        // Set clipboard to text
        clipboard.Set(text);
        Thread.Sleep(50);

        // Press Ctrl+V
        PressKey("ctrl+v");
        Thread.Sleep(100);

        // Restore clipboard
        if (saved != null)
            clipboard.Set(saved);
    }

    // --- Scroll ---

    public void Scroll(string direction, int amount = 3, string? onRef = null,
        bool smooth = false, int? pixels = null)
    {
        // Move mouse to element if specified
        if (onRef != null)
        {
            var center = GetElementCenter(onRef);
            SetCursorPos(center.x, center.y);
            Thread.Sleep(10);
        }

        int wheelDelta = pixels ?? (amount * 120); // 120 = one wheel tick

        if (smooth)
        {
            int steps = 20;
            int stepDelta = wheelDelta / steps;
            for (int i = 0; i < steps; i++)
            {
                SendWheelEvent(direction, stepDelta);
                Thread.Sleep(20);
            }
        }
        else
        {
            SendWheelEvent(direction, wheelDelta);
        }
    }

    public void ScrollTo(string refStr)
    {
        var element = ResolveElement(refStr);
        if (element.TryGetCurrentPattern(ScrollItemPattern.Pattern, out var scrollObj))
        {
            ((ScrollItemPattern)scrollObj).ScrollIntoView();
            return;
        }

        // Fallback: scroll until element is visible
        var rect = element.Current.BoundingRectangle;
        if (!rect.IsEmpty) return; // Already has bounds, likely visible

        // Try scrolling parent
        throw new ACException(ErrorCodes.InvalidParams, "Element does not support scroll-into-view");
    }

    // --- Drag ---

    public void Drag(int fromX, int fromY, int toX, int toY,
        int durationMs = 500, int steps = 20, string[]? modifiers = null)
    {
        // Guard against divide-by-zero when steps is 0 or negative
        if (steps <= 0) steps = 1;

        // Hold modifiers
        if (modifiers != null)
            foreach (var mod in modifiers) HoldModifier(mod, true);

        SetCursorPos(fromX, fromY);
        Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, IntPtr.Zero);
        Thread.Sleep(30);

        // Interpolate movement
        int stepDelay = durationMs / steps;
        for (int i = 1; i <= steps; i++)
        {
            float t = (float)i / steps;
            int x = fromX + (int)((toX - fromX) * t);
            int y = fromY + (int)((toY - fromY) * t);
            SetCursorPos(x, y);
            Thread.Sleep(stepDelay);
        }

        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, IntPtr.Zero);

        // Release modifiers
        if (modifiers != null)
            foreach (var mod in modifiers) HoldModifier(mod, false);
    }

    public void DragByRef(string fromRef, string toRef,
        int durationMs = 500, int steps = 20, string[]? modifiers = null)
    {
        var from = GetElementCenter(fromRef);
        var to = GetElementCenter(toRef);
        Drag(from.x, from.y, to.x, to.y, durationMs, steps, modifiers);
    }

    // --- Helpers ---

    private void SendWheelEvent(string direction, int delta)
    {
        switch (direction.ToLowerInvariant())
        {
            case "up":
                mouse_event(MOUSEEVENTF_WHEEL, 0, 0, delta, IntPtr.Zero);
                break;
            case "down":
                mouse_event(MOUSEEVENTF_WHEEL, 0, 0, -delta, IntPtr.Zero);
                break;
            case "left":
                mouse_event(MOUSEEVENTF_HWHEEL, 0, 0, -delta, IntPtr.Zero);
                break;
            case "right":
                mouse_event(MOUSEEVENTF_HWHEEL, 0, 0, delta, IntPtr.Zero);
                break;
            default:
                // Unknown direction is silently ignored — callers should validate direction
                // before invoking scroll. No-op is acceptable to avoid crashing on unexpected input.
                break;
        }
    }

    private void SendUnicodeChar(char c)
    {
        var inputs = new INPUT[2];
        inputs[0] = new INPUT
        {
            type = INPUT_KEYBOARD,
            U = new InputUnion
            {
                ki = new KEYBDINPUT
                {
                    wVk = 0,
                    wScan = c,
                    dwFlags = KEYEVENTF_UNICODE,
                }
            }
        };
        inputs[1] = new INPUT
        {
            type = INPUT_KEYBOARD,
            U = new InputUnion
            {
                ki = new KEYBDINPUT
                {
                    wVk = 0,
                    wScan = c,
                    dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                }
            }
        };
        SendInput(2, inputs, Marshal.SizeOf<INPUT>());
    }

    private void SendKeyEvent(ushort vk, bool keyUp)
    {
        uint flags = keyUp ? KEYEVENTF_KEYUP : 0u;
        // Extended keys (arrows, home, end, etc.)
        if (IsExtendedKey(vk)) flags |= KEYEVENTF_EXTENDEDKEY;

        var input = new INPUT
        {
            type = INPUT_KEYBOARD,
            U = new InputUnion
            {
                ki = new KEYBDINPUT
                {
                    wVk = vk,
                    wScan = 0,
                    dwFlags = flags,
                }
            }
        };
        SendInput(1, [input], Marshal.SizeOf<INPUT>());
    }

    private void HoldModifier(string mod, bool down)
    {
        var vk = VirtualKeyFromName(mod.ToLowerInvariant().Trim());
        SendKeyEvent(vk, !down);
    }

    private static bool IsModifier(string name) => name switch
    {
        "ctrl" or "control" or "cmd" => true,
        "alt" or "opt" => true,
        "shift" => true,
        "win" or "meta" => true,
        _ => false,
    };

    private static bool IsExtendedKey(ushort vk) =>
        vk is >= 0x21 and <= 0x28 // PageUp..Down arrow
        or 0x2D or 0x2E // Insert, Delete
        or 0x5B or 0x5C // Win keys
        or >= 0x60 and <= 0x6F; // Numpad

    public static ushort VirtualKeyFromName(string name) => name switch
    {
        "enter" or "return" => 0x0D,
        "tab" => 0x09,
        "escape" or "esc" => 0x1B,
        "space" => 0x20,
        "backspace" => 0x08,
        "delete" or "del" => 0x2E,
        "up" => 0x26,
        "down" => 0x28,
        "left" => 0x25,
        "right" => 0x27,
        "home" => 0x24,
        "end" => 0x23,
        "pageup" => 0x21,
        "pagedown" => 0x22,
        "f1" => 0x70, "f2" => 0x71, "f3" => 0x72, "f4" => 0x73,
        "f5" => 0x74, "f6" => 0x75, "f7" => 0x76, "f8" => 0x77,
        "f9" => 0x78, "f10" => 0x79, "f11" => 0x7A, "f12" => 0x7B,
        "ctrl" or "control" or "cmd" => 0xA2, // VK_LCONTROL (cmd maps to ctrl on Windows)
        "alt" or "opt" => 0xA4, // VK_LMENU
        "shift" => 0xA0, // VK_LSHIFT
        "win" or "meta" => 0x5B, // VK_LWIN
        "capslock" => 0x14,
        "numlock" => 0x90,
        "scrolllock" => 0x91,
        "insert" => 0x2D,
        "printscreen" => 0x2C,
        "pause" => 0x13,
        "a" => 0x41, "b" => 0x42, "c" => 0x43, "d" => 0x44,
        "e" => 0x45, "f" => 0x46, "g" => 0x47, "h" => 0x48,
        "i" => 0x49, "j" => 0x4A, "k" => 0x4B, "l" => 0x4C,
        "m" => 0x4D, "n" => 0x4E, "o" => 0x4F, "p" => 0x50,
        "q" => 0x51, "r" => 0x52, "s" => 0x53, "t" => 0x54,
        "u" => 0x55, "v" => 0x56, "w" => 0x57, "x" => 0x58,
        "y" => 0x59, "z" => 0x5A,
        "0" => 0x30, "1" => 0x31, "2" => 0x32, "3" => 0x33,
        "4" => 0x34, "5" => 0x35, "6" => 0x36, "7" => 0x37,
        "8" => 0x38, "9" => 0x39,
        "-" or "minus" => 0xBD,
        "=" or "equals" or "plus" => 0xBB,
        "[" or "bracketleft" => 0xDB,
        "]" or "bracketright" => 0xDD,
        "\\" or "backslash" => 0xDC,
        ";" or "semicolon" => 0xBA,
        "'" or "quote" => 0xDE,
        "," or "comma" => 0xBC,
        "." or "period" => 0xBE,
        "/" or "slash" => 0xBF,
        "`" or "grave" or "backtick" => 0xC0,
        _ => throw new ACException(ErrorCodes.InvalidParams, $"Unknown key: {name}")
    };
}
