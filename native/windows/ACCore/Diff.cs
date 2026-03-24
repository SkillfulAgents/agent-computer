namespace ACCore;

public class DiffHelper
{
    private List<string>? _lastSignatures;

    public object Changed(List<ElementInfo> currentElements)
    {
        var currentSigs = BuildSignatures(currentElements);

        if (_lastSignatures == null)
        {
            _lastSignatures = currentSigs;
            return new { changed = false, added_count = 0, removed_count = 0 };
        }

        var prevSet = new HashSet<string>(_lastSignatures);
        var currSet = new HashSet<string>(currentSigs);

        int added = currSet.Except(prevSet).Count();
        int removed = prevSet.Except(currSet).Count();

        _lastSignatures = currentSigs;

        return new { changed = added > 0 || removed > 0, added_count = added, removed_count = removed };
    }

    public object Diff(List<ElementInfo> currentElements)
    {
        var currentSigs = BuildSignatures(currentElements);
        var currentMap = BuildSignatureMap(currentElements);

        if (_lastSignatures == null)
        {
            _lastSignatures = currentSigs;
            return new { added = Array.Empty<object>(), removed = Array.Empty<object>() };
        }

        var prevSet = new HashSet<string>(_lastSignatures);
        var currSet = new HashSet<string>(currentSigs);

        var addedSigs = currSet.Except(prevSet);
        var removedSigs = prevSet.Except(currSet);

        var added = addedSigs.Select(sig =>
        {
            currentMap.TryGetValue(sig, out var el);
            return el != null ? new { role = el.Role, label = el.Label, value = el.Value, @ref = el.Ref }
                : new { role = "unknown", label = (string?)null, value = (string?)null, @ref = "" };
        }).ToArray();

        var removed = removedSigs.Select(sig => new { signature = sig }).ToArray();

        _lastSignatures = currentSigs;

        return new { added, removed };
    }

    public void SetLastSnapshot(List<ElementInfo> elements)
    {
        _lastSignatures = BuildSignatures(elements);
    }

    private List<string> BuildSignatures(List<ElementInfo> elements)
    {
        var sigs = new List<string>();
        foreach (var el in elements)
        {
            sigs.Add($"{el.Role}|{el.Label}|{el.Value}|{el.Ref}");
            if (el.Children != null)
                sigs.AddRange(BuildSignatures(el.Children));
        }
        return sigs;
    }

    private Dictionary<string, ElementInfo> BuildSignatureMap(List<ElementInfo> elements)
    {
        var map = new Dictionary<string, ElementInfo>();
        foreach (var el in elements)
        {
            var sig = $"{el.Role}|{el.Label}|{el.Value}|{el.Ref}";
            map.TryAdd(sig, el);
            if (el.Children != null)
            {
                foreach (var kv in BuildSignatureMap(el.Children))
                    map.TryAdd(kv.Key, kv.Value);
            }
        }
        return map;
    }
}
