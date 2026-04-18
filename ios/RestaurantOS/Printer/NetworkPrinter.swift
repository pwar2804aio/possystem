import Foundation
import Network

/**
 * NetworkPrinter — sends ESC/POS bytes to any TCP/9100 WiFi printer.
 * Uses Network.framework (iOS 12+) for direct TCP socket connection.
 * Compatible with: Sunmi NT311, Epson TM-m30, Star TSP654, any ESC/POS printer.
 */
class NetworkPrinter {

    typealias PrintCallback = (Result<Void, Error>) -> Void

    private let queue = DispatchQueue(label: "co.posup.rpos.printer", qos: .userInitiated)

    func print(ipAddress: String, port: UInt16, data: Data, completion: @escaping PrintCallback) {
        let host = NWEndpoint.Host(ipAddress)
        let nwPort = NWEndpoint.Port(rawValue: port) ?? 9100
        let connection = NWConnection(host: host, port: nwPort, using: .tcp)

        connection.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                // Connected — send data
                connection.send(content: data, completion: .contentProcessed { error in
                    connection.cancel()
                    if let error = error {
                        completion(.failure(error))
                    } else {
                        completion(.success(()))
                    }
                })

            case .failed(let error):
                connection.cancel()
                completion(.failure(error))

            case .waiting(let error):
                connection.cancel()
                completion(.failure(error))

            default:
                break
            }
        }

        connection.start(queue: queue)

        // Timeout after 8 seconds
        queue.asyncAfter(deadline: .now() + 8.0) {
            if connection.state != .cancelled {
                connection.cancel()
                completion(.failure(NSError(
                    domain: "NetworkPrinter",
                    code: -1,
                    userInfo: [NSLocalizedDescriptionKey: "Print timeout — check printer IP and network"]
                )))
            }
        }
    }

    /// Send cash drawer pulse via ESC p command through the receipt printer RJ12 port
    func openCashDrawer(ipAddress: String, port: UInt16, completion: @escaping PrintCallback) {
        // ESC p 0 25 25 — standard cash drawer pulse
        let drawerCmd = Data([0x1b, 0x70, 0x00, 0x19, 0x19])
        self.print(ipAddress: ipAddress, port: port, data: drawerCmd, completion: completion)
    }
}
