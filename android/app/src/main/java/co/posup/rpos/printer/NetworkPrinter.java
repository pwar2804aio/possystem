package co.posup.rpos.printer;

import android.util.Base64;
import android.util.Log;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * NetworkPrinter — sends ESC/POS bytes to any TCP/9100 WiFi printer.
 * Runs on a background thread, calls back on completion.
 * Compatible with: Star TSP654ii, Epson TM series, any ESC/POS network printer.
 */
public class NetworkPrinter {

    private static final String TAG = "NetworkPrinter";
    private static final int DEFAULT_PORT = 9100;
    private static final int CONNECT_TIMEOUT_MS = 5000;
    private static final int WRITE_TIMEOUT_MS   = 8000;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    public interface PrintCallback {
        void onSuccess();
        void onError(String message);
    }

    /**
     * Print raw ESC/POS bytes to a network printer.
     *
     * @param ipAddress  Printer IP (e.g. "192.168.1.100")
     * @param port       Printer port (usually 9100)
     * @param escPosBytes Raw ESC/POS byte array
     * @param callback   Called on success or failure
     */
    public void print(String ipAddress, int port, byte[] escPosBytes, PrintCallback callback) {
        executor.execute(() -> {
            Socket socket = null;
            try {
                Log.d(TAG, "Connecting to printer " + ipAddress + ":" + port);
                socket = new Socket();
                socket.connect(new InetSocketAddress(ipAddress, port), CONNECT_TIMEOUT_MS);
                socket.setSoTimeout(WRITE_TIMEOUT_MS);

                OutputStream out = socket.getOutputStream();
                out.write(escPosBytes);
                out.flush();

                Log.d(TAG, "Print job sent: " + escPosBytes.length + " bytes");
                if (callback != null) callback.onSuccess();

            } catch (Exception e) {
                Log.e(TAG, "Print failed: " + e.getMessage());
                if (callback != null) callback.onError(e.getMessage());
            } finally {
                if (socket != null) {
                    try { socket.close(); } catch (Exception ignored) {}
                }
            }
        });
    }

    public void shutdown() {
        executor.shutdown();
    }
}
