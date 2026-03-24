using ACCore;

namespace ACCore.Tests;

public class ActionsTests
{
    // ============================================================
    // VirtualKeyFromName — Enter / Return
    // ============================================================

    [Theory]
    [InlineData("enter", 0x0D)]
    [InlineData("return", 0x0D)]
    public void VirtualKeyFromName_EnterReturn(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    // ============================================================
    // VirtualKeyFromName — Tab
    // ============================================================

    [Fact]
    public void VirtualKeyFromName_Tab()
    {
        Assert.Equal((ushort)0x09, Actions.VirtualKeyFromName("tab"));
    }

    // ============================================================
    // VirtualKeyFromName — Escape / Esc
    // ============================================================

    [Theory]
    [InlineData("escape", 0x1B)]
    [InlineData("esc", 0x1B)]
    public void VirtualKeyFromName_Escape(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    // ============================================================
    // VirtualKeyFromName — Space
    // ============================================================

    [Fact]
    public void VirtualKeyFromName_Space()
    {
        Assert.Equal((ushort)0x20, Actions.VirtualKeyFromName("space"));
    }

    // ============================================================
    // VirtualKeyFromName — Backspace
    // ============================================================

    [Fact]
    public void VirtualKeyFromName_Backspace()
    {
        Assert.Equal((ushort)0x08, Actions.VirtualKeyFromName("backspace"));
    }

    // ============================================================
    // VirtualKeyFromName — Delete / Del
    // ============================================================

    [Theory]
    [InlineData("delete", 0x2E)]
    [InlineData("del", 0x2E)]
    public void VirtualKeyFromName_Delete(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    // ============================================================
    // VirtualKeyFromName — Arrow keys
    // ============================================================

    [Theory]
    [InlineData("up", 0x26)]
    [InlineData("down", 0x28)]
    [InlineData("left", 0x25)]
    [InlineData("right", 0x27)]
    public void VirtualKeyFromName_ArrowKeys(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    // ============================================================
    // VirtualKeyFromName — Navigation keys
    // ============================================================

    [Theory]
    [InlineData("home", 0x24)]
    [InlineData("end", 0x23)]
    [InlineData("pageup", 0x21)]
    [InlineData("pagedown", 0x22)]
    public void VirtualKeyFromName_NavigationKeys(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    // ============================================================
    // VirtualKeyFromName — F1 through F12
    // ============================================================

    [Theory]
    [InlineData("f1", 0x70)]
    [InlineData("f2", 0x71)]
    [InlineData("f3", 0x72)]
    [InlineData("f4", 0x73)]
    [InlineData("f5", 0x74)]
    [InlineData("f6", 0x75)]
    [InlineData("f7", 0x76)]
    [InlineData("f8", 0x77)]
    [InlineData("f9", 0x78)]
    [InlineData("f10", 0x79)]
    [InlineData("f11", 0x7A)]
    [InlineData("f12", 0x7B)]
    public void VirtualKeyFromName_FunctionKeys(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    // ============================================================
    // VirtualKeyFromName — Modifier keys
    // ============================================================

    [Theory]
    [InlineData("ctrl", 0xA2)]
    [InlineData("control", 0xA2)]
    [InlineData("cmd", 0xA2)]
    public void VirtualKeyFromName_CtrlVariants(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    [Theory]
    [InlineData("alt", 0xA4)]
    [InlineData("opt", 0xA4)]
    public void VirtualKeyFromName_AltVariants(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    [Fact]
    public void VirtualKeyFromName_Shift()
    {
        Assert.Equal((ushort)0xA0, Actions.VirtualKeyFromName("shift"));
    }

    [Theory]
    [InlineData("win", 0x5B)]
    [InlineData("meta", 0x5B)]
    public void VirtualKeyFromName_WinMeta(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    // ============================================================
    // VirtualKeyFromName — Letters a-z
    // ============================================================

    [Fact]
    public void VirtualKeyFromName_AllLetters()
    {
        for (char c = 'a'; c <= 'z'; c++)
        {
            ushort expected = (ushort)(0x41 + (c - 'a'));
            Assert.Equal(expected, Actions.VirtualKeyFromName(c.ToString()));
        }
    }

    [Theory]
    [InlineData("a", 0x41)]
    [InlineData("m", 0x4D)]
    [InlineData("z", 0x5A)]
    public void VirtualKeyFromName_SpecificLetters(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    // ============================================================
    // VirtualKeyFromName — Digits 0-9
    // ============================================================

    [Fact]
    public void VirtualKeyFromName_AllDigits()
    {
        for (int d = 0; d <= 9; d++)
        {
            ushort expected = (ushort)(0x30 + d);
            Assert.Equal(expected, Actions.VirtualKeyFromName(d.ToString()));
        }
    }

    [Theory]
    [InlineData("0", 0x30)]
    [InlineData("5", 0x35)]
    [InlineData("9", 0x39)]
    public void VirtualKeyFromName_SpecificDigits(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    // ============================================================
    // VirtualKeyFromName — Punctuation / symbols
    // ============================================================

    [Theory]
    [InlineData("-", 0xBD)]
    [InlineData("minus", 0xBD)]
    public void VirtualKeyFromName_Minus(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    [Theory]
    [InlineData("=", 0xBB)]
    [InlineData("equals", 0xBB)]
    [InlineData("plus", 0xBB)]
    public void VirtualKeyFromName_Equals(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    [Theory]
    [InlineData("[", 0xDB)]
    [InlineData("bracketleft", 0xDB)]
    public void VirtualKeyFromName_LeftBracket(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    [Theory]
    [InlineData("]", 0xDD)]
    [InlineData("bracketright", 0xDD)]
    public void VirtualKeyFromName_RightBracket(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    [Theory]
    [InlineData("\\", 0xDC)]
    [InlineData("backslash", 0xDC)]
    public void VirtualKeyFromName_Backslash(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    [Theory]
    [InlineData(";", 0xBA)]
    [InlineData("semicolon", 0xBA)]
    public void VirtualKeyFromName_Semicolon(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    [Theory]
    [InlineData("'", 0xDE)]
    [InlineData("quote", 0xDE)]
    public void VirtualKeyFromName_Quote(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    [Theory]
    [InlineData(",", 0xBC)]
    [InlineData("comma", 0xBC)]
    public void VirtualKeyFromName_Comma(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    [Theory]
    [InlineData(".", 0xBE)]
    [InlineData("period", 0xBE)]
    public void VirtualKeyFromName_Period(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    [Theory]
    [InlineData("/", 0xBF)]
    [InlineData("slash", 0xBF)]
    public void VirtualKeyFromName_Slash(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    [Theory]
    [InlineData("`", 0xC0)]
    [InlineData("grave", 0xC0)]
    [InlineData("backtick", 0xC0)]
    public void VirtualKeyFromName_Grave(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    // ============================================================
    // VirtualKeyFromName — Special toggles & misc
    // ============================================================

    [Theory]
    [InlineData("capslock", 0x14)]
    [InlineData("numlock", 0x90)]
    [InlineData("scrolllock", 0x91)]
    [InlineData("insert", 0x2D)]
    [InlineData("printscreen", 0x2C)]
    [InlineData("pause", 0x13)]
    public void VirtualKeyFromName_MiscKeys(string name, ushort expected)
    {
        Assert.Equal(expected, Actions.VirtualKeyFromName(name));
    }

    // ============================================================
    // VirtualKeyFromName — Unknown key throws ACException
    // ============================================================

    [Theory]
    [InlineData("unknown_key")]
    [InlineData("")]
    [InlineData("f13")]
    [InlineData("super")]
    [InlineData("ENTER")] // case-sensitive: uppercase is not mapped
    [InlineData("Tab")]   // case-sensitive: capitalized is not mapped
    public void VirtualKeyFromName_UnknownKey_ThrowsACException(string name)
    {
        var ex = Assert.Throws<ACException>(() => Actions.VirtualKeyFromName(name));
        Assert.Equal(ErrorCodes.InvalidParams, ex.Code);
        Assert.Contains("Unknown key", ex.Message);
        Assert.Contains(name, ex.Message);
    }

    // ============================================================
    // IsModifier logic — tested indirectly via VirtualKeyFromName
    // We verify that known modifiers produce valid VK codes and
    // that non-modifier keys also produce valid VK codes (just
    // different ones). The IsModifier method is private, but we
    // can confirm the mapping is consistent.
    // ============================================================

    [Fact]
    public void ModifierKeys_AreDistinctFromNonModifierKeys()
    {
        // Modifier VK codes
        var ctrlVk = Actions.VirtualKeyFromName("ctrl");
        var altVk = Actions.VirtualKeyFromName("alt");
        var shiftVk = Actions.VirtualKeyFromName("shift");
        var winVk = Actions.VirtualKeyFromName("win");

        // Non-modifier VK codes
        var aVk = Actions.VirtualKeyFromName("a");
        var enterVk = Actions.VirtualKeyFromName("enter");
        var f1Vk = Actions.VirtualKeyFromName("f1");

        // Modifiers should all be different from each other
        var modifiers = new HashSet<ushort> { ctrlVk, altVk, shiftVk, winVk };
        Assert.Equal(4, modifiers.Count);

        // Modifiers should not overlap with common non-modifier keys
        Assert.DoesNotContain(aVk, modifiers);
        Assert.DoesNotContain(enterVk, modifiers);
        Assert.DoesNotContain(f1Vk, modifiers);
    }

    [Fact]
    public void ModifierAliases_MapToSameVK()
    {
        // ctrl, control, cmd all map to VK_LCONTROL
        Assert.Equal(Actions.VirtualKeyFromName("ctrl"), Actions.VirtualKeyFromName("control"));
        Assert.Equal(Actions.VirtualKeyFromName("ctrl"), Actions.VirtualKeyFromName("cmd"));

        // alt, opt both map to VK_LMENU
        Assert.Equal(Actions.VirtualKeyFromName("alt"), Actions.VirtualKeyFromName("opt"));

        // win, meta both map to VK_LWIN
        Assert.Equal(Actions.VirtualKeyFromName("win"), Actions.VirtualKeyFromName("meta"));
    }

    // ============================================================
    // Comprehensive: every single key mapping is a valid ushort > 0
    // ============================================================

    [Fact]
    public void VirtualKeyFromName_AllKnownKeys_ReturnNonZero()
    {
        var allKeys = new[]
        {
            "enter", "return", "tab", "escape", "esc", "space", "backspace",
            "delete", "del", "up", "down", "left", "right",
            "home", "end", "pageup", "pagedown",
            "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
            "ctrl", "control", "cmd", "alt", "opt", "shift", "win", "meta",
            "capslock", "numlock", "scrolllock", "insert", "printscreen", "pause",
            "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
            "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
            "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
            "-", "minus", "=", "equals", "plus",
            "[", "bracketleft", "]", "bracketright",
            "\\", "backslash",
            ";", "semicolon", "'", "quote",
            ",", "comma", ".", "period", "/", "slash",
            "`", "grave", "backtick",
        };

        foreach (var key in allKeys)
        {
            var vk = Actions.VirtualKeyFromName(key);
            Assert.True(vk > 0, $"Key '{key}' should map to a non-zero VK code, got {vk}");
        }
    }

    // ============================================================
    // Verify unique VK codes per distinct key (aliases share codes)
    // ============================================================

    [Fact]
    public void VirtualKeyFromName_DistinctKeys_HaveExpectedCodeRanges()
    {
        // Letters should be in 0x41..0x5A range
        for (char c = 'a'; c <= 'z'; c++)
        {
            var vk = Actions.VirtualKeyFromName(c.ToString());
            Assert.InRange(vk, (ushort)0x41, (ushort)0x5A);
        }

        // Digits should be in 0x30..0x39 range
        for (int d = 0; d <= 9; d++)
        {
            var vk = Actions.VirtualKeyFromName(d.ToString());
            Assert.InRange(vk, (ushort)0x30, (ushort)0x39);
        }

        // F-keys should be in 0x70..0x7B range
        for (int f = 1; f <= 12; f++)
        {
            var vk = Actions.VirtualKeyFromName($"f{f}");
            Assert.InRange(vk, (ushort)0x70, (ushort)0x7B);
        }
    }
}
