#import <Foundation/Foundation.h>
#import <PDFKit/PDFKit.h>

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc != 3) {
            fprintf(
                stderr,
                "Usage: extract-pdf-text <input.pdf> <output.txt>\n"
            );
            return 64;
        }

        NSString *inputPath = [NSString stringWithUTF8String:argv[1]];
        NSString *outputPath = [NSString stringWithUTF8String:argv[2]];
        NSURL *inputURL = [NSURL fileURLWithPath:inputPath];
        PDFDocument *document =
            [[PDFDocument alloc] initWithURL:inputURL];

        if (document == nil) {
            fprintf(
                stderr,
                "Unable to open PDF: %s\n",
                argv[1]
            );
            return 65;
        }

        NSMutableString *output = [NSMutableString string];
        for (NSUInteger index = 0; index < document.pageCount; index++) {
            PDFPage *page = [document pageAtIndex:index];
            NSString *pageText = page.string ?: @"";
            [output appendFormat:
                @"--- Page %lu of %lu ---\n\n%@\n\n",
                (unsigned long)index + 1,
                (unsigned long)document.pageCount,
                pageText
            ];
        }

        NSError *error = nil;
        BOOL wrote = [output writeToFile:outputPath
                              atomically:YES
                                encoding:NSUTF8StringEncoding
                                   error:&error];
        if (!wrote) {
            fprintf(
                stderr,
                "Unable to write PDF text: %s\n",
                error.localizedDescription.UTF8String
            );
            return 66;
        }

        printf(
            "Extracted %lu PDF pages to %s\n",
            (unsigned long)document.pageCount,
            argv[2]
        );
    }
    return 0;
}
