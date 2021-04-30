$( ".footer-button" ).mouseenter(function() {
  $( "#lenses" ).css("background-color", $( this ).css("background-color"));
});
$( ".footer-button" ).mouseleave(function() {
  $( "#lenses" ).css("background-color", "#a8a8a8");
});
