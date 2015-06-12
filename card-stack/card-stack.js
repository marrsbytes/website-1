function toggleOverlay(navElement, colourIndex) {
    var overlayContainer = $(navElement).parent().parent();
    overlayContainer.toggleClass("nav-open nav-open-" + colourIndex);
    var cardBackContainer = overlayContainer.children('.cardBackContainer');
    cardBackContainer.toggleClass("hide fadeIn");
    console.log(cardBackContainer);
}

function htmlEncode(value) {
    //create a in-memory div, set it's inner text(which jQuery automatically encodes)
    //then grab the encoded contents back out.  The div never exists on the page.
    return $('<div/>').text(value).html();
}

function htmlDecode(value) {
    return $('<div/>').html(value).text();
}

var deferred = $.Deferred();


// Get the ajax requests out of the way early because they
// are typically longest to complete
$.getJSON('https://api-staging.1self.co/v1/users/ed/cards',
        function() {
            console.log("accessed api for cards");
        })
    .done(function(data) {

        console.log('card data', data);
        window.cardData = data;
        deferred.resolve(data);
    })
    .fail(function(data) {
        console.log('error getting cards', data);

    });


$(function() {
    var stack;

    var colourArray = ['#dd2649', '#00a2d4', '#e93d31', '#f2ae1c', '#61b346', '#cf4b9a', '#367ec0', '#00ad87'];

    var dateRangetext = function(startRange, endRange) {
        var rangeText;
        var now = moment();

        if (startRange === endRange) {
            // single moment
            startRange = moment(startRange);
            rangeText = startRange.fromNow(); //'Yesterday';
        } else {
            // range of time
            startRange = moment(startRange);
            endRange = moment(endRange);
            rangeText = startRange.format('lll') + ' - ' + endRange.format('lll');
        }

        return rangeText;
    };

    String.prototype.supplant = function (o) {
        return this.replace(
            /\{\{([^{}]*)\}\}/g,
            function (a, b) {
                var r = o[b];
                return typeof r === 'string' || typeof r === 'number' ? r : a;
            }
        );
    };

    var htmlTemplate = [
        '<div class="cardHeader" style="background-color: {{colour}};"><p>{{headerText}}</p></div>'
      , '<div class="cardBackContainer hide">test</div>'
      , '{{cardContent}}'
      , '<div class="cardNav" style="background-color: {{colour}};"><p>{{cardNavText}}</p>'
      , '<div class="nav-toggle" style="background-color: {{colour}};" onclick="toggleOverlay(this, {{colourIndex}});">'
      , '<div class="icon"><img src="img/more-icon.png"></div></div>'
      , '</div>'
    ].join('');

    
    var buildCardHtml = function(cardData, colourIndex) {

        function cardHtml(template, supplantObject, overrides) {
            return template.supplant({
                cardContent: htmlTemplate.supplant($.extend({}, supplantObject, overrides))
            });
        }

        var generatedDate = moment(cardData.generatedDate);
        cardData.colourIndex = colourIndex;

        var html = '<input id="hidCard_{{id}}" class="cardData" type="hidden" value="{{inputValue}} /><div class="cardContainer">{{cardContent}}</div>'.supplant({
        id: cardData.id,
        inputValue: encodeURIComponent(JSON.stringify(cardData)),
    });


        var colour = colourArray[colourIndex];
        var supplantObject = {
            headerText: '',
            cardNavText: '',
            colour: colour,
            colourIndex: colourIndex,
        };

        switch (cardData.type) {
            case 'date':
                var dateNow = generatedDate.fromNow();
                    
                html = cardHtml(html, supplantObject, {
                        cardContent: '<div class="cardFullText" style="background-color: {{colour}};"><p>{{dateNow}}</p></div>'.supplant({dateNow: dateNow, colour: colour})
                    });
                break;
            case 'top10':
                html = cardHtml(html, supplantObject, {
                        headerText: dateRangetext(cardData.startRange, cardData.endRange),
                        cardContent: '<div class="cardMedia"></div><div class="cardText"><p>{{data}}</p></div>'.supplant({data: cardData.cardText || 'undefined'})
                    });
                break;
            default:
                html = cardHtml(html, supplantObject, {
                    headerText: dateRangetext(cardData.startRange, cardData.endRange),
                    cardNavText: 'Created: ' + generatedDate.format('lll'),
                    cardContent: '<div class="cardMedia"><iframe class="thumbnailFrame" src="{thumbnailUrl}" scrolling="no"></iframe></div><div class="cardText"><p>{data}</p></div>'.supplant({
                        thumbnailUrl: cardData.thumbnailMedia,
                        data: cardData.cardText || 'undefined'
                    })
                });
        }
        return html;
    };

    var renderThumbnailMedia = function(cardLi) {
        var cardData = $(cardLi).find('.cardData');
        cardData = decodeURIComponent(cardData.val());
        cardData = JSON.parse(cardData);

        if (cardData.thumbnailMedia) {
            console.log('rendering thumbnailMedia', cardData);
            $(cardLi).find('.cardMedia').append('<iframe class="thumbnailFrame" src="' + cardData.thumbnailMedia + '?lineColour=' + colourArray[cardData.colourIndex] + '" scrolling="no"></iframe>');
        }
    };

    var buildStack = function(stack) {
        deferred.done(function(cardsArray) {
            cardsArray.reverse();
            var lastLi = null;
            cardsArray.forEach(function(element, index, array) {
                var colourIndex = index;
                var li = document.createElement('li');
                li.innerHTML = buildCardHtml(element, colourIndex);
                $(li).css({
                    'border-color': colourArray[colourIndex],
                    'overflow': 'hidden'
                });
                $(li).attr('id', 'card_' + index);
                $('.stack').append(li);
                stack.createCard(li);
                lastLi = li;
            });
            markCardUnique($('.stack li:last')[0], 'topOfMain');
            deckComplete();
        });
    };

    stack = gajus.Swing.Stack();

    function bringToTop(cardEl) {
        var $cardEl = $(cardEl);
        var cardElId = $cardEl.attr('id');
        var $cardUl = $cardEl.parent();
        $cardEl.detach();
        $cardUl.append(cardEl);
    }

    function moveToLast(arr, idx) {
        var lastIdx = arr.length -1;
        var len = arr.length;
        var val = null;
        if (idx !== lastIdx) {
            val = arr[idx];
            for (var i = idx; i < len; ++i) {
                arr[i] = arr[i+1];
            }
            arr[lastIdx] = val;
        }
    }

    stack.throwInLast = function() {
        var cardLi = $('.stack .topOfDiscard')[0];
        bringToTop(cardLi);
        var val = '#' + cardLi.id;
        var idx = discardPile.indexOf(val);
        var card = stack.getCard(cardLi);
        card.throwIn(1, 100);
    }

    stack.throwOutNext = function() {
        var cardLi = $('.stack .topOfMain')[0];
        bringToTop(cardLi);
        var card = stack.getCard(cardLi);
        card.throwOut(1, 100);
    }

    window.stack = stack;
    buildStack(stack);

    function markCardUnique(cardEl, label) {
        $('.stack li').removeClass(label);
        if (cardEl !== undefined) {
            console.log('marking card', cardEl.id, label, cardEl);
            $(cardEl).addClass(label);
        }
    }
    
    var discardPile = [];
    var $cardList = null;

    function deckComplete() {
        $cardList = $('.stack li');
        $cardList.on('mousedown', function(e) {
            var id = '#' + this.id;
            var idx = discardPile.indexOf(id);
            if (idx > -1) {
                moveToLast(discardPile, idx);
                markCardUnique($(id), 'topOfDiscard');
            }
        });
    }
    
    stack.on('throwout', function(e) {
        markCardUnique($('.stack .topOfMain')[0], 'topOfMain');
        markCardUnique(e.target, 'topOfDiscard');
        discardPile.push('#' + e.target.id);
        var cardsOnDiscard = discardPile.length;
        markCardUnique($cardList[$cardList.length - 1 - cardsOnDiscard], 'topOfMain');
        e.target.classList.remove('in-deck');
        console.log('thrown out', e.target.id, discardPile);
    });

    stack.on('throwin', function(e) {
        discardPile.pop();
        var cardEl = $(discardPile[discardPile.length -1])[0];
        markCardUnique(e.target, 'topOfMain');
        markCardUnique(cardEl, 'topOfDiscard');

        e.target.classList.add('in-deck');
        console.log('thrown in', e.target.id, discardPile);
    });
});