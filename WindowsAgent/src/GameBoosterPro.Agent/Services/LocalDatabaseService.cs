using System.Text.Json;
using GameBoosterPro.Agent.Configuration;
using GameBoosterPro.Agent.Models;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Options;

namespace GameBoosterPro.Agent.Services;

public interface ILocalDatabaseService
{
    string DatabasePath { get; }
    IReadOnlyList<InstalledGame> GetAllGames();
    InstalledGame? GetGameById(string id);
    void UpsertGame(InstalledGame game);
    void ReplaceAutoScannedGames(IEnumerable<InstalledGame> scannedGames);
    bool DeleteGame(string id);

    void SetFavorite(string id, bool isFavorite);
    string RecordLastPlayed(string id);

    IReadOnlyList<string> GetCustomFolders();
    void AddCustomFolder(string folderPath);
    void RemoveCustomFolder(string folderPath);

    IReadOnlyDictionary<string, string> GetAllSettings();
    void UpsertSettings(IReadOnlyDictionary<string, string> settings);
}

public sealed class LocalDatabaseService : ILocalDatabaseService
{
    private readonly string _connectionString;
    private readonly string _dataDirectory;
    private readonly object _dbLock = new();

    public string DatabasePath { get; }

    public LocalDatabaseService(IOptions<AgentOptions> options)
    {
        _dataDirectory = options.Value.DataDirectory;
        Directory.CreateDirectory(_dataDirectory);
        DatabasePath = Path.Combine(_dataDirectory, "gamebooster.db");
        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = DatabasePath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Shared
        }.ToString();

        EnsureSchema();
        MigrateLegacyJsonIfNeeded();
    }

    private SqliteConnection OpenConnection()
    {
        var conn = new SqliteConnection(_connectionString);
        conn.Open();
        return conn;
    }

    private void EnsureSchema()
    {
        lock (_dbLock)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                PRAGMA journal_mode = WAL;

                CREATE TABLE IF NOT EXISTS games (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    version TEXT,
                    cover_image_url TEXT,
                    executable_name TEXT NOT NULL,
                    executable_path TEXT NOT NULL,
                    install_path TEXT NOT NULL,
                    detected_gpu TEXT NOT NULL,
                    launcher TEXT NOT NULL,
                    size_gb REAL NOT NULL,
                    last_played TEXT,
                    compatibility TEXT NOT NULL,
                    estimated_fps_range TEXT NOT NULL,
                    recommended_resolution TEXT NOT NULL,
                    vram_requirement_mb INTEGER NOT NULL,
                    is_optimized_profile_active INTEGER NOT NULL DEFAULT 0,
                    is_manual_entry INTEGER NOT NULL DEFAULT 0,
                    is_installed INTEGER NOT NULL DEFAULT 1,
                    is_favorite INTEGER NOT NULL DEFAULT 0,
                    launch_uri TEXT,
                    safety_note_ar TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS custom_folders (
                    folder_path TEXT PRIMARY KEY,
                    added_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS app_settings (
                    setting_key TEXT PRIMARY KEY,
                    setting_value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """;
            cmd.ExecuteNonQuery();
        }
    }

    private void MigrateLegacyJsonIfNeeded()
    {
        try
        {
            // Preserve legacy manual_games.json entries if games table has no manual rows yet
            var legacyManual = Path.Combine(_dataDirectory, "manual_games.json");
            if (File.Exists(legacyManual))
            {
                var existing = GetAllGames();
                if (!existing.Any(g => g.IsManualEntry))
                {
                    var items = JsonSerializer.Deserialize<List<InstalledGame>>(File.ReadAllText(legacyManual));
                    if (items is not null)
                    {
                        foreach (var item in items)
                        {
                            UpsertGame(item with { IsManualEntry = true });
                        }
                    }
                }
            }

            var legacyFolders = Path.Combine(_dataDirectory, "custom_folders.json");
            if (File.Exists(legacyFolders) && GetCustomFolders().Count == 0)
            {
                var folders = JsonSerializer.Deserialize<List<string>>(File.ReadAllText(legacyFolders));
                if (folders is not null)
                {
                    foreach (var folder in folders)
                    {
                        AddCustomFolder(folder);
                    }
                }
            }

            var legacyMeta = Path.Combine(_dataDirectory, "game_metadata.json");
            if (File.Exists(legacyMeta))
            {
                var meta = JsonSerializer.Deserialize<LocalGameLibraryMetadata>(File.ReadAllText(legacyMeta));
                if (meta is not null)
                {
                    foreach (var favId in meta.FavoriteIds)
                    {
                        SetFavorite(favId, true);
                    }
                }
            }
        }
        catch
        {
            // Non-fatal: continue cleanly with SQLite DB
        }
    }

    public IReadOnlyList<InstalledGame> GetAllGames()
    {
        lock (_dbLock)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                SELECT id, title, version, cover_image_url, executable_name, executable_path, install_path,
                       detected_gpu, launcher, size_gb, last_played, compatibility, estimated_fps_range,
                       recommended_resolution, vram_requirement_mb, is_optimized_profile_active,
                       is_manual_entry, is_installed, is_favorite, launch_uri, safety_note_ar
                FROM games
                ORDER BY is_favorite DESC, is_manual_entry DESC, title COLLATE NOCASE ASC;
                """;

            var list = new List<InstalledGame>();
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(ReadGameRow(reader));
            }
            return list;
        }
    }

    public InstalledGame? GetGameById(string id)
    {
        lock (_dbLock)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                SELECT id, title, version, cover_image_url, executable_name, executable_path, install_path,
                       detected_gpu, launcher, size_gb, last_played, compatibility, estimated_fps_range,
                       recommended_resolution, vram_requirement_mb, is_optimized_profile_active,
                       is_manual_entry, is_installed, is_favorite, launch_uri, safety_note_ar
                FROM games
                WHERE id = $id
                LIMIT 1;
                """;
            cmd.Parameters.AddWithValue("$id", id);

            using var reader = cmd.ExecuteReader();
            return reader.Read() ? ReadGameRow(reader) : null;
        }
    }

    public void UpsertGame(InstalledGame game)
    {
        lock (_dbLock)
        {
            using var conn = OpenConnection();
            UpsertGameInternal(conn, null, game);
        }
    }

    public void ReplaceAutoScannedGames(IEnumerable<InstalledGame> scannedGames)
    {
        lock (_dbLock)
        {
            using var conn = OpenConnection();
            using var tx = conn.BeginTransaction();

            // Preserve favorites and lastPlayed for auto-detected games before refreshing auto-scan rows
            var preservedState = new Dictionary<string, (bool IsFavorite, string? LastPlayed, bool IsOptimized)>(StringComparer.OrdinalIgnoreCase);
            using (var selectCmd = conn.CreateCommand())
            {
                selectCmd.Transaction = tx;
                selectCmd.CommandText = "SELECT id, is_favorite, last_played, is_optimized_profile_active FROM games;";
                using var r = selectCmd.ExecuteReader();
                while (r.Read())
                {
                    preservedState[r.GetString(0)] = (
                        r.GetInt32(1) == 1,
                        r.IsDBNull(2) ? null : r.GetString(2),
                        r.GetInt32(3) == 1
                    );
                }
            }

            using (var deleteCmd = conn.CreateCommand())
            {
                deleteCmd.Transaction = tx;
                deleteCmd.CommandText = "DELETE FROM games WHERE is_manual_entry = 0;";
                deleteCmd.ExecuteNonQuery();
            }

            foreach (var raw in scannedGames)
            {
                if (raw.IsManualEntry) continue;

                var game = raw;
                if (preservedState.TryGetValue(raw.Id, out var prev))
                {
                    game = raw with
                    {
                        IsFavorite = prev.IsFavorite || raw.IsFavorite,
                        LastPlayed = prev.LastPlayed ?? raw.LastPlayed,
                        IsOptimizedProfileActive = prev.IsOptimized || raw.IsOptimizedProfileActive
                    };
                }

                UpsertGameInternal(conn, tx, game);
            }

            tx.Commit();
        }
    }

    public bool DeleteGame(string id)
    {
        lock (_dbLock)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM games WHERE id = $id;";
            cmd.Parameters.AddWithValue("$id", id);
            return cmd.ExecuteNonQuery() > 0;
        }
    }

    public void SetFavorite(string id, bool isFavorite)
    {
        lock (_dbLock)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "UPDATE games SET is_favorite = $fav, updated_at = $now WHERE id = $id;";
            cmd.Parameters.AddWithValue("$fav", isFavorite ? 1 : 0);
            cmd.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O"));
            cmd.Parameters.AddWithValue("$id", id);
            cmd.ExecuteNonQuery();
        }
    }

    public string RecordLastPlayed(string id)
    {
        var stamp = DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm");
        lock (_dbLock)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "UPDATE games SET last_played = $lp, updated_at = $now WHERE id = $id;";
            cmd.Parameters.AddWithValue("$lp", stamp);
            cmd.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O"));
            cmd.Parameters.AddWithValue("$id", id);
            cmd.ExecuteNonQuery();
        }
        return stamp;
    }

    public IReadOnlyList<string> GetCustomFolders()
    {
        lock (_dbLock)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT folder_path FROM custom_folders ORDER BY added_at ASC;";
            var list = new List<string>();
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(reader.GetString(0));
            }
            return list;
        }
    }

    public void AddCustomFolder(string folderPath)
    {
        lock (_dbLock)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                INSERT INTO custom_folders (folder_path, added_at)
                VALUES ($path, $now)
                ON CONFLICT(folder_path) DO NOTHING;
                """;
            cmd.Parameters.AddWithValue("$path", folderPath);
            cmd.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O"));
            cmd.ExecuteNonQuery();
        }
    }

    public void RemoveCustomFolder(string folderPath)
    {
        lock (_dbLock)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM custom_folders WHERE LOWER(folder_path) = LOWER($path);";
            cmd.Parameters.AddWithValue("$path", folderPath.Trim());
            cmd.ExecuteNonQuery();
        }
    }

    public IReadOnlyDictionary<string, string> GetAllSettings()
    {
        lock (_dbLock)
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT setting_key, setting_value FROM app_settings;";
            var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                dict[reader.GetString(0)] = reader.GetString(1);
            }
            return dict;
        }
    }

    public void UpsertSettings(IReadOnlyDictionary<string, string> settings)
    {
        lock (_dbLock)
        {
            using var conn = OpenConnection();
            using var tx = conn.BeginTransaction();
            var now = DateTimeOffset.UtcNow.ToString("O");

            foreach (var (key, value) in settings)
            {
                if (string.IsNullOrWhiteSpace(key)) continue;
                using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = """
                    INSERT INTO app_settings (setting_key, setting_value, updated_at)
                    VALUES ($key, $val, $now)
                    ON CONFLICT(setting_key) DO UPDATE SET
                        setting_value = excluded.setting_value,
                        updated_at = excluded.updated_at;
                    """;
                cmd.Parameters.AddWithValue("$key", key.Trim());
                cmd.Parameters.AddWithValue("$val", value ?? string.Empty);
                cmd.Parameters.AddWithValue("$now", now);
                cmd.ExecuteNonQuery();
            }

            tx.Commit();
        }
    }

    private static void UpsertGameInternal(SqliteConnection conn, SqliteTransaction? tx, InstalledGame g)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            INSERT INTO games (
                id, title, version, cover_image_url, executable_name, executable_path, install_path,
                detected_gpu, launcher, size_gb, last_played, compatibility, estimated_fps_range,
                recommended_resolution, vram_requirement_mb, is_optimized_profile_active,
                is_manual_entry, is_installed, is_favorite, launch_uri, safety_note_ar, updated_at
            )
            VALUES (
                $id, $title, $version, $cover, $exeName, $exePath, $installPath,
                $gpu, $launcher, $sizeGb, $lastPlayed, $compat, $fpsRange,
                $res, $vram, $optActive,
                $isManual, $isInstalled, $isFav, $launchUri, $safetyNote, $now
            )
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                version = excluded.version,
                cover_image_url = COALESCE(excluded.cover_image_url, games.cover_image_url),
                executable_name = excluded.executable_name,
                executable_path = excluded.executable_path,
                install_path = excluded.install_path,
                detected_gpu = excluded.detected_gpu,
                launcher = excluded.launcher,
                size_gb = excluded.size_gb,
                last_played = COALESCE(games.last_played, excluded.last_played),
                compatibility = excluded.compatibility,
                estimated_fps_range = excluded.estimated_fps_range,
                recommended_resolution = excluded.recommended_resolution,
                vram_requirement_mb = excluded.vram_requirement_mb,
                is_manual_entry = excluded.is_manual_entry,
                is_installed = excluded.is_installed,
                is_favorite = MAX(excluded.is_favorite, games.is_favorite),
                launch_uri = excluded.launch_uri,
                safety_note_ar = excluded.safety_note_ar,
                updated_at = excluded.updated_at;
            """;

        cmd.Parameters.AddWithValue("$id", g.Id);
        cmd.Parameters.AddWithValue("$title", g.Title);
        cmd.Parameters.AddWithValue("$version", (object?)g.Version ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$cover", (object?)g.CoverImageUrl ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$exeName", g.ExecutableName);
        cmd.Parameters.AddWithValue("$exePath", g.ExecutablePath);
        cmd.Parameters.AddWithValue("$installPath", g.InstallPath);
        cmd.Parameters.AddWithValue("$gpu", g.DetectedGpu);
        cmd.Parameters.AddWithValue("$launcher", g.Launcher);
        cmd.Parameters.AddWithValue("$sizeGb", g.SizeGb);
        cmd.Parameters.AddWithValue("$lastPlayed", (object?)g.LastPlayed ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$compat", g.Compatibility);
        cmd.Parameters.AddWithValue("$fpsRange", g.EstimatedFpsRange);
        cmd.Parameters.AddWithValue("$res", g.RecommendedResolution);
        cmd.Parameters.AddWithValue("$vram", g.VramRequirementMb);
        cmd.Parameters.AddWithValue("$optActive", g.IsOptimizedProfileActive ? 1 : 0);
        cmd.Parameters.AddWithValue("$isManual", g.IsManualEntry ? 1 : 0);
        cmd.Parameters.AddWithValue("$isInstalled", g.IsInstalled ? 1 : 0);
        cmd.Parameters.AddWithValue("$isFav", g.IsFavorite ? 1 : 0);
        cmd.Parameters.AddWithValue("$launchUri", (object?)g.LaunchUri ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$safetyNote", g.SafetyNoteAr);
        cmd.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O"));
        cmd.ExecuteNonQuery();
    }

    private static InstalledGame ReadGameRow(SqliteDataReader r) =>
        new(
            Id: r.GetString(0),
            Title: r.GetString(1),
            Version: r.IsDBNull(2) ? null : r.GetString(2),
            CoverImageUrl: r.IsDBNull(3) ? null : r.GetString(3),
            ExecutableName: r.GetString(4),
            ExecutablePath: r.GetString(5),
            InstallPath: r.GetString(6),
            DetectedGpu: r.GetString(7),
            Launcher: r.GetString(8),
            SizeGb: r.GetDouble(9),
            LastPlayed: r.IsDBNull(10) ? null : r.GetString(10),
            Compatibility: r.GetString(11),
            EstimatedFpsRange: r.GetString(12),
            RecommendedResolution: r.GetString(13),
            VramRequirementMb: r.GetInt32(14),
            IsOptimizedProfileActive: r.GetInt32(15) == 1,
            IsManualEntry: r.GetInt32(16) == 1,
            SafetyNoteAr: r.GetString(20),
            IsInstalled: r.GetInt32(17) == 1,
            IsFavorite: r.GetInt32(18) == 1,
            LaunchUri: r.IsDBNull(19) ? null : r.GetString(19)
        );
}
