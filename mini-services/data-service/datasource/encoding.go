package datasource

import (
	"io"
	"strings"

	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"
)

// decodeGBK converts a GBK-encoded byte slice to a UTF-8 string.
// Sina and Tencent Finance APIs return GBK-encoded responses,
// so we must convert to UTF-8 before further processing.
func decodeGBK(data []byte) (string, error) {
	reader := transform.NewReader(strings.NewReader(string(data)), simplifiedchinese.GBK.NewDecoder())
	decoded, err := io.ReadAll(reader)
	if err != nil {
		return string(data), err
	}
	return string(decoded), nil
}

// readBodyAsUTF8 reads an io.Reader (HTTP response body) and returns
// the content as a UTF-8 string, converting from GBK if necessary.
func readBodyAsUTF8(body io.Reader) (string, error) {
	raw, err := io.ReadAll(body)
	if err != nil {
		return "", err
	}
	return decodeGBK(raw)
}
