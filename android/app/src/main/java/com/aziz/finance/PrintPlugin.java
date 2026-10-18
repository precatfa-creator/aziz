package com.aziz.finance;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * window.print() does nothing in an Android WebView, so the web app calls this
 * instead. It prints the WebView itself — honouring the page's @media print
 * rules — through Android's print service, whose "Save as PDF" makes the file.
 */
@CapacitorPlugin(name = "AzizPrint")
public class PrintPlugin extends Plugin {
    @PluginMethod
    public void print(PluginCall call) {
        String name = call.getString("name", "Aziz");
        getActivity().runOnUiThread(() -> {
            PrintManager printManager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
            PrintDocumentAdapter adapter = getBridge().getWebView().createPrintDocumentAdapter(name);
            printManager.print(
                name,
                adapter,
                new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build()
            );
            call.resolve();
        });
    }
}
