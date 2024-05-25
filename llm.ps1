# Boolean zum Aktivieren/Deaktivieren des Loggings
$enableLogging = $false

# Pfad zur .gitignore Datei
$gitignorePath = ".\.gitignore"

# Initialisiere die Ausgabe Datei
$outputFile = "llm.txt"
if (Test-Path $outputFile) {
    Remove-Item $outputFile
}

# Debug-Ausgabe initialisieren
$debugLogFile = "debug_log.txt"
if (Test-Path $debugLogFile) {
    Remove-Item $debugLogFile
}

function Write-DebugLog {
    param (
        [string]$message
    )
    if ($enableLogging) {
        Add-Content -Path $debugLogFile -Value $message
    }
}

Write-DebugLog "Lese .gitignore Datei: $gitignorePath"

# Lies die .gitignore Datei aus und erstelle ein Array von ignorierten Pfaden/Dateien
$ignorePatterns = Get-Content $gitignorePath | Where-Object { $_ -and $_ -notmatch '^\s*#' }

# Füge package-lock.json zu den Ignoriermustern hinzu
$ignorePatterns += "package-lock.json"

Write-DebugLog "Gefundene Muster in .gitignore:"
$ignorePatterns | ForEach-Object { Write-DebugLog $_ }

# Funktion zum Überprüfen, ob ein Pfad ignoriert werden sollte
function ShouldIgnore {
    param (
        [string]$filePath,
        [string[]]$patterns
    )
    Write-DebugLog "Prüfe '$filePath' nach ignorierten Mustern"

    $normalizedFilePath = $filePath.Replace("\", "/")
    foreach ($pattern in $patterns) {
        $normalizedPattern = $pattern.Replace("\", "/").TrimEnd("/")
        $escapedPattern = [regex]::Escape($normalizedPattern).Replace("\*", ".*").Replace("\?", ".")
        
        # Verschiedene Varianten des Musters erzeugen
        $patternsToTest = @(
            $escapedPattern,
            "$escapedPattern/.*",
            "$escapedPattern\.*",
            "$escapedPattern/*",
            "$escapedPattern"
        )
        
        foreach ($testPattern in $patternsToTest) {
            if ($normalizedFilePath -match $testPattern) {
                Write-DebugLog "Datei oder Verzeichnis '$filePath' ignoriert durch Muster '$pattern' (Testmuster '$testPattern')"
                return $true
            }
        }
    }
    return $false
}

# Funktion zum rekursiven Durchlaufen der Verzeichnisse
function ProcessDirectory {
    param (
        [string]$currentDir,
        [string[]]$patterns
    )
    Write-DebugLog "Bearbeite '$currentDir'"

    # Verzeichnisse durchsuchen
    Get-ChildItem -Path $currentDir -Directory | ForEach-Object {
        $relativePath = $_.FullName.Substring($PWD.Path.Length + 1)
        if (-not (ShouldIgnore -filePath $relativePath -patterns $patterns)) {
            Write-DebugLog "Bearbeite Verzeichnis '$relativePath'"
            ProcessDirectory -currentDir $_.FullName -patterns $patterns
        } else {
            Write-DebugLog "Überspringe Verzeichnis: $relativePath"
        }
    }

    # Dateien durchsuchen
    Get-ChildItem -Path $currentDir -File | ForEach-Object {
        $relativePath = $_.FullName.Substring($PWD.Path.Length + 1)
        if (-not (ShouldIgnore -filePath $relativePath -patterns $patterns)) {
            Write-DebugLog "Prüfe Datei '$relativePath'"
            Add-Content -Path $outputFile -Value "Dateipfad: $relativePath"
            Add-Content -Path $outputFile -Value (Get-Content -Path $_.FullName -Raw)
            Add-Content -Path $outputFile -Value ""
        } else {
            Write-DebugLog "Überspringe Datei: $relativePath"
        }
    }
}

# Starte den Prozess im aktuellen Verzeichnis
ProcessDirectory -currentDir $PWD.Path -patterns $ignorePatterns

Write-DebugLog "Skript abgeschlossen."
