-- Export every Apple Notes note to one HTML file each (macOS only).
--
--   osascript export_notes_mac.applescript ~/Desktop/notes_export
--
-- The iPhone's notes must be on the Mac via the same iCloud account.
-- Each file starts with a `notes-meta` comment (title / folder / dates)
-- that scripts/normalize_notes.mjs reads. Password-locked notes cannot be
-- read by AppleScript and are skipped; the count is reported at the end.
-- First run: macOS will ask to allow the terminal to control Notes.

on replaceText(t, f, r)
	set {tid, AppleScript's text item delimiters} to {AppleScript's text item delimiters, f}
	set parts to text items of t
	set AppleScript's text item delimiters to r
	set t to parts as text
	set AppleScript's text item delimiters to tid
	return t
end replaceText

on jsonEscape(t)
	set t to my replaceText(t, "\\", "\\\\")
	set t to my replaceText(t, "\"", "\\\"")
	set t to my replaceText(t, return, " ")
	set t to my replaceText(t, linefeed, " ")
	set t to my replaceText(t, tab, " ")
	return t
end jsonEscape

on pad(n, width)
	set s to n as text
	repeat while (length of s) < width
		set s to "0" & s
	end repeat
	return s
end pad

on isoDate(d)
	return (my pad(year of d as integer, 4)) & "-" & (my pad(month of d as integer, 2)) & "-" & (my pad(day of d as integer, 2)) & "T" & (my pad(hours of d, 2)) & ":" & (my pad(minutes of d, 2)) & ":" & (my pad(seconds of d, 2))
end isoDate

on writeUtf8(filePath, content)
	set fRef to open for access (POSIX file filePath) with write permission
	try
		set eof of fRef to 0
		write content to fRef as «class utf8»
		close access fRef
	on error errMsg number errNum
		close access fRef
		error errMsg number errNum
	end try
end writeUtf8

on run argv
	if (count of argv) > 0 then
		set outDir to item 1 of argv
	else
		set outDir to (POSIX path of (path to desktop folder)) & "notes_export"
	end if
	if outDir does not end with "/" then set outDir to outDir & "/"
	do shell script "mkdir -p " & quoted form of outDir

	set exported to 0
	set skipped to 0
	tell application "Notes"
		repeat with acc in accounts
			set accName to (name of acc) as text
			repeat with n in notes of acc
				try
					set noteTitle to (name of n) as text
					set noteBody to (body of n) as text
					set folderName to ""
					try
						set folderName to (name of container of n) as text
					end try
					set c to my isoDate(creation date of n)
					set m to my isoDate(modification date of n)
					set exported to exported + 1
					set meta to "<!-- notes-meta: {\"title\": \"" & my jsonEscape(noteTitle) & "\", \"folder\": \"" & my jsonEscape(accName & "/" & folderName) & "\", \"created\": \"" & c & "\", \"modified\": \"" & m & "\"} -->"
					my writeUtf8(outDir & "note-" & my pad(exported, 4) & ".html", meta & linefeed & noteBody & linefeed)
				on error
					set skipped to skipped + 1
				end try
			end repeat
		end repeat
	end tell
	return "Exported " & exported & " notes to " & outDir & " (skipped " & skipped & " locked/unreadable)"
end run
