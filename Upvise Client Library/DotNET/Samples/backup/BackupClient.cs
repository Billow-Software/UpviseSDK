﻿using System;
using System.IO;
using System.Net;
using System.Web;

namespace com.upvise.samples {
    class BackupClient {

        // To find your backup URL, login as Admin your in your Upvise Web Account, go to Settings and Backup on left pane
        // and copy / paste the URL

        string BACKUP_URL = "https://www.upvise.com/uws/backup?action=download&token=[XXXXX]";
         
        string BACKUP_FOLDER = @"C:\temp\BACKUP";
        public void Run() {

            // Make sure the backup folder exists
            if (Directory.Exists(BACKUP_FOLDER) == false) {
                Directory.CreateDirectory(BACKUP_FOLDER);
            }

            // Returns the most recent backup filename. 
            string last = getMostRecentBackupFilename();
            // Add the most recent backup filename to the URL in order to return only newer backup
            string url = BACKUP_URL + "&last=" + HttpUtility.UrlEncode(last);
            
            try {
                Console.WriteLine("Downloading Backup...");
                WebClient http = new WebClient();
                byte[] data = http.DownloadData(url);

               if (data.Length > 0) {
                    string filename = "backup.zip";

                    // Try to extract the filename from the Content-Disposition header
                    string contentDisposition = http.ResponseHeaders["Content-Disposition"];
                    if (!string.IsNullOrEmpty(contentDisposition)) {
                        int index = contentDisposition.IndexOf("filename=") + 10;
                        filename = contentDisposition.Substring(index).Replace("\"", "");
                    }

                    File.WriteAllBytes(Path.Combine(BACKUP_FOLDER, filename), data);
                    Console.WriteLine("Backup Downloaded : " + filename);
                } else {
                    // if the return data is 0 byte length, it means there is no newer backup than the last backup we have
                    Console.WriteLine("No newer backup is available");
                }
            } catch(Exception e) {
                Console.WriteLine("Backup failed: " + e.Message);
            }
           
        }

        public string getMostRecentBackupFilename() {
            FileInfo mostRecent = null;
            string[] files = Directory.GetFiles(BACKUP_FOLDER, "*.zip", SearchOption.TopDirectoryOnly);
            foreach (string file in files) {
                FileInfo info = new FileInfo(file);
                if (mostRecent == null) mostRecent = info;
                else if (info.LastWriteTime > mostRecent.LastWriteTime) {
                    mostRecent = info;
                }
            }
            return (mostRecent != null) ? mostRecent.Name : null;
        }
         
    }
}
