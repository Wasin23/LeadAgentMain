OneDrive guidance for Meridian repository

Problem: OneDrive is syncing large binary files and node_modules, causing "too many files" or storage issues.

Quick recommendations:

1. Use OneDrive selective sync
   - Right-click OneDrive icon > Settings > Choose folders > uncheck this project or large folders like `node_modules`, `.next`, `dist`.

2. Keep node_modules out of OneDrive
   - Either use selective sync, or run the included script `scripts/move-node-modules-out-of-onedrive.ps1` to move heavy folders to a local cache and create NTFS junctions.

3. Keep repository clean
   - Ensure `.gitignore` includes `node_modules`, `.next`, `dist`, `.env.local`, etc.

Undo guidance (if you used the script):
- Remove the junctions (use `rmdir <path>`), then move the folders back from the cache to the repo.

If you want, I can:
- Add a restore script to move folders back.
- Remove Electron devDependencies from `package.json` (already done).
- Help run the move script or walk through OneDrive settings.